const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6jia9zl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    const database = client.db("summerCamp");
    const userCollection = database.collection("users");
    const classCollection = database.collection("classes");
    const selectedClassCollection = database.collection("selected-classes");
    const paymentHistoryCollection = database.collection("payments-history");
    const enrolledClassCollection = database.collection("enrolled-classes");

    // verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // verifyInstructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // verifyStudent
    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role === "instructor" || user?.role === "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // Create jwt token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Get all classes
    app.get("/classes", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // Get all approved classes
    app.get("/classes-approved", async (req, res) => {
      const query = { status: "approved" };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // Get specific instructor's class
    app.get(
      "/classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;

        const decodedEmail = req.decoded.email;
        if (decodedEmail !== email) {
          return res
            .status(403)
            .send({ error: true, message: "forbidden access" });
        }

        const query = { instructorEmail: email };
        const result = await classCollection.find(query).toArray();
        res.send(result);
      }
    );

    // Get specific class
    app.get("/class/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });

    // Create class
    app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem);

      if (result.insertedId) {
        console.log("Item added successfully!");
      } else {
        console.log("Item added failed!");
      }
      res.send(result);
    });

    // Update class
    app.patch("/classes/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const updateItem = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...updateItem,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      if (result.modifiedCount > 0) {
        console.log("Class updated successfully!");
      } else {
        console.log("Class updated failed!");
      }
      res.send(result);
    });

    // Change classes status
    app.patch(
      "/classes/change-status/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const status = req.body.status;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: status,
          },
        };
        const result = await classCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          console.log("Role updated successfully!");
        } else {
          console.log("Role updated failed!");
        }
        res.send(result);
      }
    );

    // Add classes feedback
    app.patch(
      "/classes/add-feedback/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const feedback = req.body.feedback;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            feedback: feedback,
          },
        };
        const result = await classCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          console.log("Status updated successfully!");
        } else {
          console.log("Status updated failed!");
        }
        res.send(result);
      }
    );

    // Get specific student's selected classes
    app.get(
      "/selected-classes/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const email = req.params.email;

        const decodedEmail = req.decoded.email;
        if (decodedEmail !== email) {
          return res
            .status(403)
            .send({ error: true, message: "forbidden access" });
        }

        const query = { studentEmail: email };
        const result = await selectedClassCollection.find(query).toArray();
        res.send(result);
      }
    );

    // Get specific student's selected single class for payment
    app.get(
      "/selected-class/:id",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await selectedClassCollection.findOne(query);
        res.send(result);
      }
    );

    // Get specific student's enrolled classes
    app.get(
      "/enrolled-classes/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const email = req.params.email;

        const decodedEmail = req.decoded.email;
        if (decodedEmail !== email) {
          return res
            .status(403)
            .send({ error: true, message: "forbidden access" });
        }

        const query = { studentEmail: email };
        const result = await enrolledClassCollection.find(query).toArray();
        res.send(result);
      }
    );

    // Get specific student's payment history
    app.get(
      "/payments-history/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const email = req.params.email;

        const decodedEmail = req.decoded.email;
        if (decodedEmail !== email) {
          return res
            .status(403)
            .send({ error: true, message: "forbidden access" });
        }

        const query = { studentEmail: email };
        const result = await paymentHistoryCollection
          .find(query)
          .sort({ date: -1 })
          .toArray();
        res.send(result);
      }
    );

    // Delete specific student's selected class
    app.delete(
      "/selected-classes/:id",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await selectedClassCollection.deleteOne(query);
        if (result.deletedCount === 1) {
          console.log("Successfully deleted one document.");
        } else {
          console.log("No documents matched the query. Deleted 0 documents.");
        }
        res.send(result);
      }
    );

    // Check class isExist
    app.get("/exist-classes", verifyJWT, async (req, res) => {
      const { email, id } = req.query;
      const query = {
        studentEmail: email,
        classId: id,
      };
      const existInSelectedClass = await selectedClassCollection.findOne(query);
      const existInEnrolledClass = await enrolledClassCollection.findOne(query);
      if (existInEnrolledClass || existInSelectedClass) {
        res.send({ isExist: true });
      } else {
        res.send({ isExist: false });
      }
    });

    // Added class
    app.post("/selected-classes", verifyJWT, async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedClassCollection.insertOne(selectedClass);

      if (result.insertedId) {
        console.log("Class added successfully!");
      } else {
        console.log("Class added failed!");
      }
      res.send(result);
    });

    // Get top 6 classes(filtered by student number)
    app.get("/classes-top", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({
          totalEnrolled: -1,
        }) // Sort by enrolledStudent in descending order
        .limit(6) // Limit the result to the top 6 classes
        .toArray();
      res.send(result);
    });

    // Get all user
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Get specific user for role
    app.get("/users-role/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Get all instructor users
    app.get("/users-instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // Get top 6 instructors(filtered by student number)
    app.get("/instructor-top", async (req, res) => {
      const result = await userCollection
        .find()
        .sort({
          totalStudents: -1,
        }) // Sort by totalStudents in descending order
        .limit(6) // Limit the result to the top 6 instructors
        .toArray();
      res.send(result);
    });

    // Save firebase created user in database
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Change user role
    app.patch(
      "/users/change-role/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const role = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: role,
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          console.log("Role updated successfully!");
        } else {
          console.log("Role updated failed!");
        }
        res.send(result);
      }
    );

    // Stripe payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Stripe payments submit
    app.post("/payments", async (req, res) => {
      const { paymentHistory, enrolledClass } = req.body;

      // Added payments history
      const insertPaymentHistory = await paymentHistoryCollection.insertOne(
        paymentHistory
      );

      // Added enrolled class
      const insertEnrolledClass = await enrolledClassCollection.insertOne(
        enrolledClass
      );

      // Delete class from selected class
      const selectedClassQuery = { classId: enrolledClass.classId };
      const deleteSelectedClass = await selectedClassCollection.deleteOne(
        selectedClassQuery
      );

      // Update class with total enrolled and available seat
      const filterClass = { _id: new ObjectId(enrolledClass.classId) };
      const singleClass = await classCollection.findOne(filterClass);
      const updateDocClass = {
        $set: {
          availableSeats: singleClass.availableSeats - 1,
          totalEnrolled: singleClass.totalEnrolled
            ? singleClass.totalEnrolled + 1
            : 1,
        },
      };
      const updateSeats = await classCollection.updateOne(
        filterClass,
        updateDocClass
      );

      // Update instructor with total student
      const filterInstructor = { email: enrolledClass.instructorEmail };
      const singleInstructor = await userCollection.findOne(filterInstructor);
      const updateDocInstructor = {
        $set: {
          totalStudents: singleInstructor.totalStudents
            ? singleInstructor.totalStudents + 1
            : 1,
        },
      };
      const updateInstructor = await userCollection.updateOne(
        filterInstructor,
        updateDocInstructor
      );

      res.send({
        insertPaymentHistory,
        insertEnrolledClass,
        deleteSelectedClass,
        updateSeats,
        updateInstructor,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server Running...");
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
