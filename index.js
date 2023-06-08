require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to Rhymove");
});

const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@rhymove.e6rkbia.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const classesCollection = client.db("rhymoveDB").collection("classes");
    const instructorsCollection = client
      .db("rhymoveDB")
      .collection("instructors");

    // ??? Get the classes collection
    app.get("/popular-classes", async (req, res) => {
      const classes = await classesCollection
        .find()
        .sort({ enrolledStudents: -1 })
        .limit(6)
        .toArray();
      res.send(classes);
    });

    // ??? Get the instructors collection
    app.get("/popular-instructors", async (req, res) => {
      const instructors = await instructorsCollection.find().limit(6).toArray();
      res.send(instructors);
    });
    app.get("/instructors", async (req, res) => {
      const instructors = await instructorsCollection.find().toArray();
      res.send(instructors);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
