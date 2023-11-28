const express = require('express');
require('dotenv').config()
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SK)

// middlewares
app.use(express.json())
app.use(cors())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r8yk5up.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // database collections
        const classCollection = client.db('QuillAcademy').collection('classes');
        const feedbackCollection = client.db('QuillAcademy').collection('feedback');
        const teacherRequestCollection = client.db('QuillAcademy').collection('teacherRequest');
        const userCollection = client.db('QuillAcademy').collection('users');
        const paymentCollection = client.db('QuillAcademy').collection('payments');


        // =-=-=-=-=-=-=-=-==-=-=-=-=-=-= API CREATION START =-=-=-=-=-=-=-=-==-=-=-=-=-=-= //

        // apis for payment
        app.post('/payments', async (req, res) => {
            const paymentInfo = req.body;
            const result = await paymentCollection.insertOne(paymentInfo);
            res.send(result);
        })
        app.post('/payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            })
            res.send({ paymentSecret: paymentIntent.client_secret })
        })

        // apis for users
        app.get('/users/:email', async (req, res) => {
            const query = { email: req.params.email }
            const options = {
                projection: {_id: 0, role:1}
            }
            const result = await userCollection.findOne(query, options);
            res.send(result)
        })
        app.patch('/users/:email', async (req, res) => {
            const updates = req.body;
            const query = { email: req.params.email }
            const updateDoc = {
                $set: updates
            }
            const result = await userCollection.updateOne(query, updateDoc)
            res.send(result);
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send({ message: "user already exist", insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // apis for teacher
        app.get('/teacher-requests', async (req, res) => {
            const result = await teacherRequestCollection.find().toArray();
            res.send(result);
        })
        app.post('/teacher-request', async (req, res) => {
            const teacherData = req.body;
            console.log('object', teacherData);
            const result = await teacherRequestCollection.insertOne(teacherData);
            res.send(result);
        })

        // apis for classes
        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classCollection.findOne(query);
            res.send(result);
        })

        app.get('/categories/:category', async (req, res) => {
            const category = req.params.category;
            const filter = { category: category }
            const result = await classCollection.find(filter).toArray();
            res.send(result);
        })

        app.get('/all-classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        })

        app.get('/recommended-classes', async (req, res) => {
            const query = {}
            const options = {
                sort: { enrolled_students: -1 }
            }
            const result = await classCollection.find(query, options).toArray();
            const finalResult = result.slice(0, 6)
            res.send(finalResult);
        })

        // api for feedback
        app.get('/feedbacks', async (req, res) => {
            const result = await feedbackCollection.find().toArray();
            res.send(result);
        })
        // =-=-=-=-=-=-=-=-==-=-=-=-=-=-= API CREATION END =-=-=-=-=-=-=-=-==-=-=-=-=-=-= //


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server is running!')
})

app.listen(port, () => {
    console.log('server running on port: ', port);
})