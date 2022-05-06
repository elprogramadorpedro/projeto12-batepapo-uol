import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import Joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// CONNECTING MONGODB
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
    db = mongoClient.db(process.env.DATABASE);
});

// SCHEMAS
const newParticipantSchema = Joi.object({
    name: Joi.string().required(),
});

// TODO changes "from" to validate if user is in users list
const newMessageSchema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().pattern(/^(private_message|message)$/),
    time: Joi.any(),
});

// STARTING SERVER
app.listen(process.env.PORT, () => {
    console.log("Server running on port", process.env.PORT);
});

// PARTICIPANTS ROUTE
app.get("/participants", async (req, res) => {
    try {
        const users = await db.collection("users").find().toArray();
        res.send(users);
    } catch (error) {
        res.send(500);
    }
});

app.post("/participants", async (req, res) => {
    const newParticipant = req.body;

    try {
        await newParticipantSchema.validateAsync(newParticipant, {
            abortEarly: false,
        });
    } catch (error) {
        res.status(422).send(error.details.map((err) => err.message));
        return;
    }

    const user = await db
        .collection("users")
        .findOne({ name: newParticipant.name });

    if (user) {
        res.sendStatus(409);
        return;
    }

    const registerUserMessage = {
        from: newParticipant.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
    };

    try {
        await db.collection("users").insertOne({
            ...newParticipant,
            lastStatus: Date.now(),
        });

        await db.collection("messages").insertOne({
            ...registerUserMessage,
        });

        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    }
});
// MESSAGES ROUTE

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;

    let messages = [];

    try {
        if (limit) {
            messages = await db
                .collection("messages")
                .find({}, { limit, sort: { time: -1 } })
                .toArray();
        } else {
            messages = await db.collection("messages").find().toArray();
        }

        const filteredMessages = messages.filter((message) => {
            if (
                message.type === "private_message" &&
                (message.to === user || message.from === user)
            )
                return true;
            else if (message.type === "private_message") return false;
            else return true;
        });

        if (limit) {
            res.send([...filteredMessages].reverse());
            return;
        } else {
            res.send(filteredMessages);
            return;
        }
    } catch (error) {
        res.sendStatus(500);
    }
});
app.post("/messages", async (req, res) => {
    const { user } = req.headers;
    const newMessage = {
        ...req.body,
        from: user,
        time: dayjs().format("HH:mm:ss"),
    };
    try {
        await newMessageSchema.validateAsync(newMessage, {
            abortEarly: false,
        });
    } catch (error) {
        res.status(422).send(error.details.map((err) => err.message));
        return;
    }
    try {
        await db.collection("messages").insertOne({ ...newMessage });
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    }
});