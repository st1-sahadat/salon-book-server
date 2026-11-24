import express from "express";
import cors from "cors"
import "dotenv/config"
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from "jose";


const PORT = 5000;
const app = express();
app.use(cors());
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

// User verify cheaker
const verifyToken = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).send({ msg: 'Unauthorized!' })
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).send({ msg: 'Unauthorized!' })
    }
    console.log(token);

    const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
    try{
    const {payload} = await jwtVerify(token, JWKS);
    console.log(payload);
    next();
    }catch(error){
        console.error("Token verification failed:", error);
        return res.status(401).send({ msg: "Unauthorized!" })
    }
}

// home
app.get("/", (req, res) =>{
    res.send("Server Home Page!")
})
// service
app.get('/services', async (req, res) => {
    const result = await allService.find().toArray();
    res.send(result)
})
app.get('/six-services', async (req, res) => {
    const result = await allService.find().limit(6).toArray();
    res.send(result);
});
// Service ID API and Email API
app.get('/services/:id', verifyToken,  async (req, res) => {
    const { id } = req.params;
  if (ObjectId.isValid(id)) {
    const result = await allService.findOne({ _id: new ObjectId(id) });
    return res.send(result);
  }
  const result = await allService.find({ email: id }).toArray();
  res.send(result);
})
// Categories
// Map URL slug -> category name stored in DB
const categoryMap = {
  'haircut-styling':    'Haircut & Styling',
  'hair-coloring':      'Hair Coloring',
  'hair-treatment':     'Hair Treatment',
  'facial-skincare':    'Facial & Skincare',
  'makeup':             'Makeup',
  'manicure-pedicure':  'Manicure & Pedicure',
  'spa-massage':        'Spa & Massage',
};
const handleCategoryRequest = async (req, res) => {
  try {
    const rawCategory = req.params.category;
    const categoryName = categoryMap[rawCategory] || rawCategory;
    if (!categoryName) {
      return res.status(404).json({ error: 'Category not found' });
    }
    // Match either exact category name or case-insensitive regex
    const result = await allService.find({
      category: { $regex: new RegExp(`^${categoryName}$`, 'i') },
    }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

app.get('/CTG&:category', handleCategoryRequest);
app.get('/CTG/:category', handleCategoryRequest);
app.get('/category/:category', handleCategoryRequest);

// Appointment Endpoints
app.get('/appointments', async (req, res) => {
  try {
    const result = await allAppointments.find().sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching appointments' });
  }
});
app.get('/appointments/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await allAppointments.find({ customerEmail: email }).sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching customer appointments' });
  }
});
app.post('/appointments', async (req, res) => {
  try {
    const appointment = req.body;
    const result = await allAppointments.insertOne({
      ...appointment,
      status: appointment.status || 'Pending',
      paymentStatus: appointment.paymentStatus || 'Unpaid',
      createdAt: appointment.createdAt || new Date().toISOString(),
    });
    res.status(201).json({ success: true, insertedId: result.insertedId, appointment });
  } catch (err) {
    res.status(500).json({ error: 'Server error saving appointment' });
  }
});

// Transactions Endpoints (transactions collection)
app.get('/transactions', async (req, res) => {
  try {
    const result = await allTransactions.find().sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching transactions' });
  }
});

app.get('/transactions/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await allTransactions.find({ customerEmail: email }).sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching user transactions' });
  }
});

app.post('/transactions', async (req, res) => {
  try {
    const transaction = req.body;
    const result = await allTransactions.insertOne({
      ...transaction,
      createdAt: transaction.createdAt || new Date().toISOString(),
    });
    res.status(201).json({ success: true, insertedId: result.insertedId, transaction });
  } catch (err) {
    res.status(500).json({ error: 'Server error saving transaction' });
  }
});

// runing port
app.listen(PORT, () => {
    console.log(`Server is runnign on port ${PORT}`);    
})
export default app;












