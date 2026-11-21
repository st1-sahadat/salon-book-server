import express from "express";
import cors from "cors"
import "dotenv/config"
import { MongoClient, ObjectId } from 'mongodb';


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


app.get("/", (req, res) =>{
    res.send("Server Home Page!")
})

app.get('/services', async (req, res) => {
    const result = await allService.find().toArray();
    res.send(result)
})
app.get('/six-services', async (req, res) => {
    const result = await allService.find().limit(6).toArray();
    res.send(result);
});
// Service ID API and Email API
app.get('/services/:id',  async (req, res) => {
    const { id } = req.params;
  if (ObjectId.isValid(id)) {
    const result = await allService.findOne({ _id: new ObjectId(id) });
    return res.send(result);
  }
  const result = await allService.find({ email: id }).toArray();
  res.send(result);
})

// Map URL slug -> category name stored in DB
const categoryMap = {
  'haircut-styling':    'Haircut & Styling',
  'hair-coloring':      'Hair Coloring',
  'hair-treatment':     'Hair Treatment',
  'makeup':             'Makeup',
  'manicure-pedicure':  'Manicure & Pedicure',
  'spa-massage':        'Spa & Massage',
};
app.get('/CTG&:category', async (req, res) => {
  try {
    const category = categoryMap[req.params.category];
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const result = await allService.find({ category }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

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


app.listen(PORT, () => {
    console.log(`Server is runnign on port ${PORT}`);    
})


export default app;












