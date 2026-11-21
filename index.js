import express from "express";
import cors from "cors"
import "dotenv/config"
import { MongoClient } from 'mongodb';


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
const allService = db.collection("services")


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


app.listen(PORT, () => {
    console.log(`Server is runnign on port ${PORT}`);    
})


export default app;












