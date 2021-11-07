const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();

//MIDDLEWARE
app.use(cors());
app.use(express.json())
//MONGO CONNECT
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.urbpc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const run = async () => {
    try {
        await client.connect();
        const database = client.db('doctors_portal')
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');
        //ADD A APPOINTMENT
        app.post('/appointment/book', async (req, res) => {
            const doc = req.body;
            const result = await appointmentsCollection.insertOne(doc);
            res.json(result);
        })

        //GET SIGNLE PATIENT APPOINTMENTS
        app.get('/appointments', async (req, res) => {
            const uid = req.query.uid;
            const date = new Date(req.query.date).toDateString();
            const query = { patientUid: uid, treatmentDate: date };
            const cursor = appointmentsCollection.find(query);
            const result = await cursor.toArray();
            res.json(result);
        })

        //SEND USER DATA TO DATABASE
        app.put('/users', async (req, res) => {
            const uid = req.body.uid;
            const query = { uid: uid };
            const options = { upsert: true };
            const updatedoc = { $set: req.body };
            const result = await usersCollection.updateOne(query, updatedoc, options);
            res.json(result);
        })

    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Node server is online');
})
app.listen(port, () => {
    console.log('Server is running on port: ', port)
})