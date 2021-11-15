const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;



const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

//MIDDLEWARE
app.use(cors());
app.use(express.json());

//VERIFY TOKEN
const verifyToken = async (req, res, next) => {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers?.authorization?.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}
//

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
            const date = req.query.date;
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

        //ADD ADMIN ROLE
        app.put('/users/admin', verifyToken, async (req, res) => {
            const adminEmail = req.body.adminEmail;
            const decodedUserEmail = req.decodedEmail;
            if (decodedUserEmail) {
                const requesterAccount = await usersCollection.findOne({ email: decodedUserEmail });
                if (requesterAccount.role === 'admin') {
                    const query = { email: adminEmail };
                    const updatedoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(query, updatedoc);
                    res.json(result);
                }
                else {
                    res.status(403).json({ message: 'You dont have access to make an admin' })
                }
            }
        })

        //GET APPOINTMENT INFO
        app.get('/appointment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const appointment = await appointmentsCollection.findOne(query);
            res.json(appointment);
        })

        //FILTER IF CURRENT USER ADMIN OR NOT
        app.get('/users/:uid', async (req, res) => {
            const uid = req.params.uid;
            const query = { uid: uid, role: 'admin' }
            const result = await usersCollection.findOne(query);
            if (result?.role === 'admin') {
                res.json({ isAdmin: true })
            }
            else {
                res.json({ isAdmin: false })
            }
        })

        //PAYMENT
        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.json({ clientSecret: paymentIntent.client_secret })
        });

        //UPDATE APPOINTMENT AFTER PAYMENT
        app.put('/appointment/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const query = { _id: ObjectId(id) }
            const updatedoc = {
                $set: {
                    payment: payment
                }
            }
            const result = await appointmentsCollection.updateOne(query, updatedoc);
            res.json(result)
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