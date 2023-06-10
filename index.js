const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access." });
  }
  const token = authorization.split(" ")[1];
  // console.log(process.env.USER_SECRET_TOKEN);

  jwt.verify(token, process.env.USER_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access 2." });
    }
    console.log("Decoded :", req.decoded);
    req.decoded = decoded;
    next();
  });
};

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
    // ??? ***************************** All collections  ******************************
    const classesCollection = client.db("rhymoveDB").collection("classes");
    const instructorsCollection = client
      .db("rhymoveDB")
      .collection("instructors");
    const usersCollection = client.db("rhymoveDB").collection("users");
    const selectedClassCollection = client
      .db("rhymoveDB")
      .collection("selectedClass");

    // JWT Authorization
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.USER_SECRET_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log(email);
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (user?.rule !== "admin") {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      next();
    };

    // ??? ***************************** Classes collection  ******************************
    app.get("/popular-classes", async (req, res) => {
      const classes = await classesCollection
        .find()
        .sort({ enrolledStudents: -1 })
        .limit(6)
        .toArray();
      res.send(classes);
    });
    app.get("/classes", async (req, res) => {
      const classes = await classesCollection.find().toArray();
      res.send(classes);
    });
    app.post("/selected-class", async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedClassCollection.insertOne(selectedClass);
      res.send(result);
    });
    app.get("/selected-class", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);
      if (req.decoded.email !== email)
        return res
          .status(401)
          .send({ error: true, message: "Forbidden access token" });
      const query = { email: email };
      const selectedClass = await selectedClassCollection.find(query).toArray();
      res.send(selectedClass);
    });
    app.delete("/selected-class/:id", async (req, res) => {
      const id = req.params.id;
      const result = await selectedClassCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // ???  *************************** Instructors collection  ***************************
    app.get("/popular-instructors", async (req, res) => {
      const instructors = await instructorsCollection.find().limit(6).toArray();
      res.send(instructors);
    });
    app.get("/instructors", async (req, res) => {
      const instructors = await instructorsCollection.find().toArray();
      res.send(instructors);
    });

    // ???  ******************************** Users collections  *******************************
    app.post("/users", verifyJWT, async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.status(409).send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      console.log("Hello");
      const email = req.params.email;
      console.log(email);
      if (req.decoded.email !== email) return res.send({ admin: false });
      const filter = { email };
      const user = await usersCollection.findOne(filter);
      const result = { admin: user?.rule === "admin" };
      res.send(result);
    });
    app.patch("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email };
      const updateDoc = {
        $set: {
          rule: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email };
      const updateDoc = {
        $set: {
          rule: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
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
