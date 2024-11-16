import express from "express";
import { MongoClient, ServerApiVersion } from 'mongodb';
import 'dotenv/config'
import cors from 'cors'
import jwt from 'jsonwebtoken'
const app = express();
const port = 3001;
// middlewares

const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://design-card-corner.web.app'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(express.json(corsOptions))
app.use(cors());
// mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zrua0aj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const verifyToken = async (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}
async function run() {
    try {
        const db = client.db('designXpress-DB');
        const usersCollection = db.collection('users');
        const productsCollection = db.collection('products');
        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // Get a specific user from db
        app.get('/users', verifyToken, async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) {
                    return res.status(400).json({ message: 'Email query parameter is required.' });
                }
                const user = await usersCollection.findOne({ email });
                if (!user) {
                    return res.status(404).json({ message: 'User not found with the provided email.' });
                }
                res.status(200).json(user);
            } catch (error) {
                console.error('Error fetching user:', error.message);
                res.status(500).json({ message: 'Internal Server Error' });
            }
        })
        // Save user data to db
        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const query = { email: user.email };
                const existingEmail = await usersCollection.findOne(query);
                if (existingEmail) {
                    return res.send({ massage: 'User already exits' });
                }
                const result = await usersCollection.insertOne(user);
                res.send(result);
            }
            catch (error) {
                console.error('Error creating user , ', error.massage);
                res.status(500).json({ massage: "Internal server error" });
            }
        })
        // Get all products
        app.get('/products', async (req, res) => {
            try {
                const { page = 1, limit = 10 } = req.query;
                const skip = (parseInt(page) - 1) * parseInt(limit);

                // Validation to ensure proper data for pagination
                if (isNaN(page) || page <= 0) {
                    return res.status(400).json({ message: 'Page number must be greater than 0.' });
                }
                if (isNaN(limit) || limit <= 0) {
                    return res.status(400).json({ message: 'Limit must be greater than 0.' });
                }

                const products = await productsCollection
                    .find()  // Find all products
                    .skip(skip)  // Skip products for pagination
                    .limit(parseInt(limit))  // Limit the number of products returned
                    .toArray();  // Convert to array

                const totalProducts = await productsCollection.countDocuments();  // Get the total number of products

                // Calculate total pages based on total number of products
                const totalPages = Math.ceil(totalProducts / parseInt(limit));

                // Return products with pagination data
                res.status(200).json({
                    products,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages,
                        totalProducts,
                        limit: parseInt(limit),
                    },
                });
            } catch (error) {
                console.error('Error fetching products:', error.message);
                res.status(500).json({ message: 'Internal Server Error' });
            }
        });
        // add a new product in DB
        app.post('/add-product', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const productData = req.body;
                const productId = Math.random().toString(36).substring(2, 16 + 2);
                productData.productId = productId;
                const result = await productsCollection.insertOne(productData);
                res.status(201).send(result);
            }
            catch (error) {
                console.error('Error creating user , ', error.massage);
                res.status(500).json({ massage: "Internal server error" });
            }
        })

        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
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
    res.send('Hello World!')
})
// jwt
app.post('/auth', async (req, res) => {
    const userEmail = req.body;
    const token = jwt.sign(userEmail, process.env.JWT_ACCESS_TOKEN, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.send({ token });
})
app.listen(port, () => {
    console.log(`designXpress server listening on port ${port}`)
})