require("dotenv").config();
const stripe = require('stripe')('sk_test_51R4TV5CtaNmtadhYmdeRteYeoN4geSwEynfxN3qnl6FgKXRKVFW9AZ15uBA1VLQnduj0PQ1VUIoOQBGG5tvjyWih002HgRQOfl');
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5001;
const YOUR_DOMAIN = `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
});

const UserModel = mongoose.model("User", UserSchema);

// ✅ STUDY DATA SCHEMA
const StudySchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  studyData: String,
  timestamp: { type: Date, default: Date.now },
});

const StudyModel = mongoose.model("Study", StudySchema);

app.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UserModel({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    console.log("Request received:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await UserModel.findOne({ email });

    if (!user) {
      console.log("User not found in DB.");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("Password does not match.");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    console.log("Login successful for:", email);
    res.json({ message: "Login successful!", token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Access denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });

    req.userId = decoded.userId;
    next();
  });
};

app.post("/saveStudyData", verifyToken, async (req, res) => {
  try {
    const newData = new StudyModel({
      userId: req.userId,
      studyData: req.body.studyData,
    });
    await newData.save();
    res.json({ message: "Study data saved successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Error saving data" });
  }
});

app.get("/getStudyData", verifyToken, async (req, res) => {
  try {
    const data = await StudyModel.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(1);
    res.json(data.length ? data[0] : { studyData: "No data found" });
  } catch (error) {
    res.status(500).json({ error: "Error fetching data" });
  }
});

// get donate page returning html file
app.get('/donate', (req, res) => {
  res.sendFile(__dirname + '/donate.html');
});

app.post('/donate', async (req, res) => {
  // let amount = 20;
  const { amount, email } = req.body;

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "cad",
          product_data: {
            name: "Donation",
          },
          unit_amount: amount * 100, // Amount in cents (100 = $1.00)
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${YOUR_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${YOUR_DOMAIN}/cancel`,
    customer_email: email,
  });

  res.redirect(303, session.url);
});

app.get('/success', async (req, res) => {
  const sessionId = req.query.session_id; // Get session_id from URL

  if (!sessionId) {
    return res.status(400).send('Session ID is required.');
  }

  try {
    // Retrieve the Checkout Session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Get the Payment Intent ID
    const paymentIntentId = session.payment_intent;

    if (paymentIntentId) {
      // Retrieve Payment Intent details
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log(paymentIntent);

      // Get the Charge ID
      const chargeId = paymentIntent.latest_charge;

      console.log(chargeId)

      // Retrieve Charge details to get the receipt URL
      const charge = await stripe.charges.retrieve(chargeId);

      console.log(charge)

      res.redirect(303, charge.receipt_url);
    } else {
      res.send('Payment successful, but no receipt found.');
    }
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});



app.get('/cancel', (req, res) => {
    res.send('Cancelled');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
