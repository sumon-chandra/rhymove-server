require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const app = express();
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

  jwt.verify(token, process.env.USER_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access 2." });
    }
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
    const paymentCollection = client.db("rhymoveDB").collection("payment");
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
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (user?.rule !== "admin") {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (user?.rule !== "instructor") {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      next();
    };

    // ??? ***************************** Classes collection  ******************************
    app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });
    app.get("/classes-for-admin", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);
      if (req.decoded.email !== email)
        return res.status(401).send({
          error: true,
          message: "Forbidden access token classes for admin",
        });

      const classes = await classesCollection.find().toArray();
      res.send(classes);
    });
    app.get("/popular-classes", async (req, res) => {
      const classes = await classesCollection
        .find()
        .sort({ enrolledStudents: -1 })
        .limit(6)
        .toArray();
      res.send(classes);
    });
    app.get("/classes", async (req, res) => {
      const filter = { status: "approved" };
      const classes = await classesCollection.find(filter).toArray();
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
    app.get("/enrolled-classes", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);
      if (req.decoded.email !== email)
        return res.status(401).send({
          error: true,
          message: "Forbidden access token for enrolled classes",
        });
      const query = { userEmail: email };
      const enrolledClasses = await paymentCollection.find(query).toArray();
      res.send(enrolledClasses);
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
    app.get("/my-classes", verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);
      if (req.decoded.email !== email)
        return res.status(401).send({
          error: true,
          message: "Forbidden access token for my classes (Instructor)",
        });
      const query = { instructorEmail: email };
      const classes = await classesCollection.find(query).toArray();
      res.send(classes);
    });
    app.patch(
      "/class-feedback/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const feedback = {
          feedback: req.body.feedback,
          feedbackWriter: req.body.feedbackWriter,
        };

        const updateDoc = {
          $set: {
            feedback: feedback,
          },
        };
        const classes = await classesCollection.updateOne(query, updateDoc);
        res.send(classes);
      }
    );
    app.patch(
      "/class-approved/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "approved",
          },
        };
        const classes = await classesCollection.updateOne(query, updateDoc);
        res.send(classes);
      }
    );
    app.patch("/class-denied/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const classes = await classesCollection.updateOne(query, updateDoc);
      res.send(classes);
    });

    // ???  ******************************** Users collections  *******************************
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({});
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) return res.send({ admin: false });
      const filter = { email };
      const user = await usersCollection.findOne(filter);
      const result = { admin: user?.rule === "admin" };
      res.send(result);
    });
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) return res.send({ instructor: false });
      const filter = { email };
      const user = await usersCollection.findOne(filter);
      const result = { instructor: user?.rule === "instructor" };
      res.send(result);
    });
    app.patch("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
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

    // ????? *****************************  Create Payment Intent ************************
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.post("/payment", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = { _id: new ObjectId(payment.paidItemId) };
      const updateDoc = {
        $set: {
          status: "paid",
        },
      };
      const updatedResult = await selectedClassCollection.updateOne(
        query,
        updateDoc
      );
      const updateClass = {
        $inc: { enrolledStudents: 1, availableSeats: -1 },
      };
      const classQuery = { _id: new ObjectId(payment.selectedClassId) };
      const updateClasses = await classesCollection.updateOne(
        classQuery,
        updateClass
      );
      const updateSelectedClasses = await selectedClassCollection.updateOne(
        query,
        updateClass
      );
      res.send({
        insertResult,
        updatedResult,
        updateClasses,
        updateSelectedClasses,
      });
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
