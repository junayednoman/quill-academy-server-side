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
const moment = require('moment/moment');
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
        const assignmentCollection = client.db('QuillAcademy').collection('assignments');
        const assignmentSubmissionCollection = client.db('QuillAcademy').collection('assignmentSubmissions');


        // =-=-=-=-=-=-=-=-==-=-=-=-=-=-= API CREATION START =-=-=-=-=-=-=-=-==-=-=-=-=-=-= //
        // apis for assignment
        app.get('/assignments/submit', async (req, res) => {
            const date = moment(new Date()).format("YYYY-MM-DD");
            const query = { submitDate: date }
            const result = await assignmentSubmissionCollection.countDocuments(query);
            res.send({ totalSubmission: result });
        })
        app.post('/assignments/submit', async (req, res) => {
            const submissionData = req.body;
            const filter = { student_email: submissionData.student_email, assignmentId: submissionData.assignmentId }
            const isExist = await assignmentSubmissionCollection.find(filter).toArray();
            // res.send(isExist)
            if (isExist.length > 0) {
                return res.send({ message: "exist" })
            }
            const result = await assignmentSubmissionCollection.insertOne(submissionData)
            res.send(result);
        })

        app.get('/assignments/:id', async (req, res) => {
            const query = {
                classId: req.params.id
            };
            const result = await assignmentCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/assignmentCount/:id', async (req, res) => {
            const query = { classId: req.params.id }
            const assignmentCount = await assignmentCollection.countDocuments(query);
            res.send({ assignmentCount })
        })
        app.post('/assignments', async (req, res) => {
            const assignmentInfo = req.body;
            const result = await assignmentCollection.insertOne(assignmentInfo);
            res.send(result);
        })

        // apis for student
        app.get('/student/enrolled-class/:email', async (req, res) => {
            const paymentQuery = { email: req.params.email }
            const options = {
                projection: { _id: 0, classId: 1 }
            }
            const myIds = await paymentCollection.find(paymentQuery, options).toArray();

            const query = {
                _id: {
                    $in: myIds.map(id => new ObjectId(id.classId))
                }
            }
            const myClasses = await classCollection.find(query).toArray();
            res.send(myClasses);
        })

        // apis for payment
        app.get('/payments/:email', async (req, res) => {
            const query = { email: req.params.email };
            const options = {
                projection: { _id: 0, classId: 1 }
            };
            const result = await paymentCollection.find(query, options).toArray();
            res.send(result);
        });

        app.post('/payments', async (req, res) => {
            const paymentInfo = req.body;
            const result = await paymentCollection.insertOne(paymentInfo);
            res.send(result);
        });
        app.post('/payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            })
            res.send({ paymentSecret: paymentIntent.client_secret })
        });

        // apis for users

        app.get('/stat-count', async (req, res) => {
            const users = await userCollection.countDocuments();
            const classes = await classCollection.countDocuments();
            const enrollments = await paymentCollection.countDocuments();
            const assignments = await assignmentCollection.countDocuments();
            res.send({ userCount: users, classCount: classes, enrollmentCount: enrollments, assignmentCount: assignments })
        })
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })
        app.get('/users/:email', async (req, res) => {
            const query = { email: req.params.email }
            const result = await userCollection.findOne(query);
            res.send(result)
        })
        app.get('/users/:email', async (req, res) => {
            const query = { email: req.params.email }
            const options = {
                projection: { _id: 0, role: 1 }
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
            const result = await userCollection.updateOne(query, updateDoc);
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
        app.patch('/teacher-request-status/:email', async (req, res) => {
            const query = { email: req.params.email }
            const updates = req.body;
            const updatedDoc = {
                $set: updates
            }
            const result = await teacherRequestCollection.updateOne(query, updatedDoc);
            res.send(result);
        })
        app.get('/teacher-requests-status/:email', async (req, res) => {
            const query = { email: req.params.email }
            const option = {
                projection: { _id: 0, status: 1 }
            }
            const result = await teacherRequestCollection.findOne(query, option);
            res.send(result);
        })
        app.get('/teacher-requests', async (req, res) => {
            const result = await teacherRequestCollection.find().toArray();
            res.send(result);
        })
        app.post('/teacher-request', async (req, res) => {
            const teacherData = req.body;
            const result = await teacherRequestCollection.insertOne(teacherData);
            res.send(result);
        })


        app.get('/categories/:category', async (req, res) => {
            const category = req.params.category;
            const filter = { category: category }
            const result = await classCollection.find(filter).toArray();
            res.send(result);
        })

        // apis for class
        app.get('/class-status/:id', async (req, res) => {
            const query = { _id: new ObjectId(req.params.id) }
            const options = {
                projection: { _id: 0, status: 1 }
            }
            const result = await classCollection.findOne(query, options);
            res.send(result);
        })
        app.patch('/class-status/:id', async (req, res) => {
            const updates = req.body;
            const query = { _id: new ObjectId(req.params.id) };
            const updatedDoc = {
                $set: { status: updates.status }
            }
            const result = await classCollection.updateOne(query, updatedDoc);
            res.send(result);
        })
        app.patch('/classes/enrolled-count/:id', async (req, res) => {
            const updatedClass = req.body;
            const query = { _id: new ObjectId(req.params.id) };
            const updatedInfo = {
                $set: updatedClass
            }
            const result = await classCollection.updateOne(query, updatedInfo);
            res.send(result);
        })
        app.get('/my-classes/:email', async (req, res) => {
            const query = { teacher_email: req.params.email }
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })

        // app.get('/classes/enrolled-student/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { classId: id }
        //     const result = await paymentCollection.find(query).toArray();
        //     res.send(result)
        // })
        app.post('/classes', async (req, res) => {
            const classInfo = req.body;
            const result = await classCollection.insertOne(classInfo);
            res.send(result);
        })
        // app.get('/classes/:id', async(req, res)=>{
        //     const id = req.params.id;
        //     console.log(id);
        // })
        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classCollection.deleteOne(query);
            res.send(result);
        })
        app.put('/classes/:id', async (req, res) => {
            const updatedClass = req.body;
            const query = { _id: new ObjectId(req.params.id) }
            const options = { upsert: true };
            const updatedInfo = {
                $set: {
                    title: updatedClass.title,
                    image: updatedClass.image,
                    teacher_name: updatedClass.teacher_name,
                    teacher_email: updatedClass.teacher_email,
                    short_description: updatedClass.short_description,
                    price: updatedClass.price,
                }
            }
            const result = await classCollection.updateOne(query, updatedInfo, updatedInfo);
            res.send(result);
        })
        app.get('/classes/enroll-count/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = {
                projection: { _id: 0, enrolled_students: 1 }
            }
            const result = await classCollection.findOne(query, options);
            res.send(result);
        })
        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classCollection.findOne(query);
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

        app.post('/feedbacks', async (req, res) => {
            const feedback = req.body;
            const result = await feedbackCollection.insertOne(feedback);
            res.send(result);
        })
        // =-=-=-=-=-=-=-=-==-=-=-=-=-=-= API CREATION END =-=-=-=-=-=-=-=-==-=-=-=-=-=-= //


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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