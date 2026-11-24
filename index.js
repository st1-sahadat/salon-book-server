import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const PORT = process.env.PORT || 5000;
const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://salon-book-puce.vercel.app",
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL.replace(/\/+$/, "")] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const client = new MongoClient(process.env.DB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("salon-book");
const allService = db.collection("services");
const allAppointments = db.collection("appointments");
const allTransactions = db.collection("transactions");

// Cached JWKS instance for performance and reliability
let cachedJWKS = null;
let cachedClientUrl = null;

const getJWKS = () => {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
  if (!cachedJWKS || cachedClientUrl !== clientUrl) {
    cachedClientUrl = clientUrl;
    cachedJWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
  }
  return cachedJWKS;
};

// Strict Token Verification Middleware
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, msg: "Unauthorized! No Authorization header provided" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.split(" ")[1] || authHeader.trim();

  if (!token) {
    return res.status(401).json({ success: false, msg: "Unauthorized! Token is missing" });
  }

  try {
    const JWKS = getJWKS();
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message || error);
    return res.status(401).json({
      success: false,
      msg: "Unauthorized! Invalid or expired token",
      error: error.message,
    });
  }
};

// Optional Token Verification Middleware (for endpoints that can accept token if present)
export const optionalVerifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.split(" ")[1] || authHeader.trim();

  if (!token) {
    return next();
  }

  try {
    const JWKS = getJWKS();
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
  } catch (error) {
    console.warn("Optional token verification notice:", error.message);
  }
  next();
};

// Home
app.get("/", (req, res) => {
  res.send("Server Home Page!");
});

// Dedicated JWT verification endpoint to test/validate tokens
app.get("/jwt-verify", verifyToken, (req, res) => {
  res.json({
    success: true,
    message: "JWT token verified successfully!",
    user: req.user,
  });
});

app.post("/jwt-verify", verifyToken, (req, res) => {
  res.json({
    success: true,
    message: "JWT token verified successfully!",
    user: req.user,
  });
});

// Services (Public / Optional token)
app.get("/services", optionalVerifyToken, async (req, res) => {
  try {
    const result = await allService.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching services" });
  }
});

// Explicit secure services endpoint (Strict verifyToken)
app.get("/services/secure", verifyToken, async (req, res) => {
  try {
    const result = await allService.find().toArray();
    res.send({ success: true, services: result, requestedBy: req.user });
  } catch (err) {
    res.status(500).json({ error: "Server error fetching secure services" });
  }
});

app.get("/six-services", async (req, res) => {
  try {
    const result = await allService.find().limit(6).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching six services" });
  }
});

// Service ID API and Email API
app.get("/services/:id", optionalVerifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (ObjectId.isValid(id)) {
      const result = await allService.findOne({ _id: new ObjectId(id) });
      return res.send(result);
    }
    const result = await allService.find({ email: id }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching service" });
  }
});

// Categories
const categoryMap = {
  "haircut-styling": "Haircut & Styling",
  "hair-coloring": "Hair Coloring",
  "hair-treatment": "Hair Treatment",
  "facial-skincare": "Facial & Skincare",
  "makeup": "Makeup",
  "manicure-pedicure": "Manicure & Pedicure",
  "spa-massage": "Spa & Massage",
};

const handleCategoryRequest = async (req, res) => {
  try {
    const rawCategory = req.params.category;
    const categoryName = categoryMap[rawCategory] || rawCategory;
    if (!categoryName) {
      return res.status(404).json({ error: "Category not found" });
    }
    const result = await allService
      .find({
        category: { $regex: new RegExp(`^${categoryName}$`, "i") },
      })
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

app.get("/CTG&:category", handleCategoryRequest);
app.get("/CTG/:category", handleCategoryRequest);
app.get("/category/:category", handleCategoryRequest);

// Appointment Endpoints (Protected with verifyToken)
app.get("/appointments", verifyToken, async (req, res) => {
  try {
    const result = await allAppointments.find().sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching appointments" });
  }
});

app.get("/appointments/:email", verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    const result = await allAppointments
      .find({ customerEmail: email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching customer appointments" });
  }
});

app.post("/appointments", verifyToken, async (req, res) => {
  try {
    const appointment = req.body;
    const result = await allAppointments.insertOne({
      ...appointment,
      status: appointment.status || "Pending",
      paymentStatus: appointment.paymentStatus || "Unpaid",
      createdAt: appointment.createdAt || new Date().toISOString(),
      verifiedUserEmail: req.user?.email || null,
    });
    res.status(201).json({ success: true, insertedId: result.insertedId, appointment });
  } catch (err) {
    res.status(500).json({ error: "Server error saving appointment" });
  }
});

// Transactions Endpoints (Protected with verifyToken)
app.get("/transactions", verifyToken, async (req, res) => {
  try {
    const result = await allTransactions.find().sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching transactions" });
  }
});

app.get("/transactions/:email", verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    const result = await allTransactions
      .find({ customerEmail: email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching user transactions" });
  }
});

app.post("/transactions", verifyToken, async (req, res) => {
  try {
    const transaction = req.body;
    const result = await allTransactions.insertOne({
      ...transaction,
      createdAt: transaction.createdAt || new Date().toISOString(),
      verifiedUserEmail: req.user?.email || null,
    });
    res.status(201).json({ success: true, insertedId: result.insertedId, transaction });
  } catch (err) {
    res.status(500).json({ error: "Server error saving transaction" });
  }
});

// running port
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
