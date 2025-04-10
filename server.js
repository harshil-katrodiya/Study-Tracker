require("dotenv").config();
const stripe = require("stripe")(
  "sk_test_51R4TV5CtaNmtadhYmdeRteYeoN4geSwEynfxN3qnl6FgKXRKVFW9AZ15uBA1VLQnduj0PQ1VUIoOQBGG5tvjyWih002HgRQOfl"
);
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 5001;
const YOUR_DOMAIN = `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname));

// -------------------- DATABASE --------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// -------------------- SCHEMAS --------------------
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
});

const UserModel = mongoose.model("User", UserSchema);

//  STUDY DATA SCHEMA
const StudySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  site: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  timeSpentInSeconds: {
    type: Number,
    required: true,
    min: 0,
    max: 86400, // Maximum 24 hours per session
  },
  lastMilestoneNotified: {
    type: Number,
    default: 0, // in minutes
  },
  timestamp: { type: Date, default: Date.now },
});

// Add virtual for minutes
StudySchema.virtual("timeSpentInMinutes").get(function () {
  return Math.round(this.timeSpentInSeconds / 60);
});

// Ensure virtuals are included in JSON and Object outputs
StudySchema.set("toJSON", { virtuals: true });
StudySchema.set("toObject", { virtuals: true });

const StudyModel = mongoose.model("Study", StudySchema);

// -------------------- ROUTES --------------------
app.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({
      email: email.toLowerCase(),
    });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UserModel({
      firstName,
      lastName,
      email: email.toLowerCase(), // store email in lowercase
      password: hashedPassword,
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Signup error:", error);
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

    const user = await UserModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log("User not found in DB.");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("Password does not match.");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate access token (1 hour) and refresh token (7 days)
    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    console.log("Login successful for:", email);
    res.json({
      message: "Login successful!",
      accessToken,
      refreshToken,
      userId: user._id,
    });
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
    console.log("Received study data:", req.body);
    let { site, timeSpentInSeconds, startTime, endTime } = req.body;

    // Coerce timeSpentInSeconds to a number (in case it is sent as a string)
    timeSpentInSeconds = Number(timeSpentInSeconds);
    if (!site || isNaN(timeSpentInSeconds) || !startTime || !endTime) {
      return res.status(400).json({
        error: "Site, timeSpentInSeconds, startTime, and endTime are required",
      });
    }

    const timeSpentInMinutes = Math.round(timeSpentInSeconds / 60);

    // Convert startTime and endTime to Date objects
    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find existing record for the same site on the same day
    const existingRecord = await StudyModel.findOne({
      userId: req.userId,
      site,
      startTime: { $gte: today },
      endTime: { $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
    });

    if (existingRecord) {
      // Update existing record
      existingRecord.endTime = endTimeDate;
      existingRecord.timeSpentInSeconds = timeSpentInSeconds;
      await existingRecord.save();

      // Check if total time spent is >= 30 minutes for email notification
      // if (existingRecord.timeSpentInSeconds >= 180) {
      //   // 30 minutes in seconds
      //   const user = await UserModel.findById(req.userId);
      //   if (user) {
      //     const transporter = nodemailer.createTransport({
      //       service: "gmail",
      //       auth: {
      //         user: process.env.EMAIL_USER,
      //         pass: process.env.EMAIL_PASS,
      //       },
      //     });

      //     const mailOptions = {
      //       from: process.env.EMAIL_USER,
      //       to: user.email,
      //       subject: "🎉 Study Milestone Achieved!",
      //       html: `
      //         <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
      //           <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
      //             <h2 style="color: #2d89ef;">Great Job! 🎉</h2>
      //             <p>Hello ${user.firstName},</p>
      //             <p>You've reached a study milestone! You've spent ${Math.floor(
      //               existingRecord.timeSpentInSeconds / 60
      //             )} minutes studying on <strong>${site}</strong> today.</p>
      //             <p>Keep up the excellent work! Your dedication to learning is impressive.</p>
      //             <hr style="margin: 30px 0;">
      //             <p style="font-size: 12px; color: #777;">Thank you for using Study Tracker!<br>The Study Tracker Team</p>
      //           </div>
      //         </div>
      //       `,
      //     };

      //     await transporter.sendMail(mailOptions);
      //     console.log(`Milestone email sent to ${user.email}`);
      //   }
      // }
      // Convert to minutes (rounded down)
      const totalMinutes = Math.floor(existingRecord.timeSpentInSeconds / 60);
      const nextMilestone = (existingRecord.lastMilestoneNotified || 0) + 2;

      if (totalMinutes >= nextMilestone) {
        const user = await UserModel.findById(req.userId);
        if (user) {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: `🎉 You've studied ${nextMilestone} minutes on ${site}!`,
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color: #2d89ef;">Awesome Job!</h2>
            <p>Hello ${user.firstName},</p>
            <p>You've spent <strong>${totalMinutes} minutes</strong> studying on <strong>${site}</strong> today.</p>
            <p>This marks your <strong>${nextMilestone}-minute milestone</strong>! 🚀</p>
            <hr style="margin: 30px 0;">
            <p style="font-size: 12px; color: #777;">Thanks for using Study Tracker!<br>The Team</p>
          </div>
        </div>
      `,
          };

          await transporter.sendMail(mailOptions);
          console.log(
            `📧 ${nextMilestone}-minute milestone email sent to ${user.email}`
          );

          // Update milestone
          existingRecord.lastMilestoneNotified = nextMilestone;
          await existingRecord.save();
        }
      }
    } else {
      // Create new record
      const newData = new StudyModel({
        userId: req.userId,
        site,
        startTime: startTimeDate,
        endTime: endTimeDate,
        timeSpentInSeconds,
        timeSpentInMinutes,
      });
      await newData.save();

      // Check if time spent is >= 30 minutes for email notification
      if (timeSpentInSeconds >= 180) {
        // 30 minutes in seconds
        const user = await UserModel.findById(req.userId);
        if (user) {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "🎉 Study Milestone Achieved!",
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
                <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                  <h2 style="color: #2d89ef;">Great Job! 🎉</h2>
                  <p>Hello ${user.firstName},</p>
                  <p>You've reached a study milestone! You've spent ${timeSpentInMinutes} minutes studying on <strong>${site}</strong>.</p>
                  <p>Keep up the excellent work! Your dedication to learning is impressive.</p>
                  <hr style="margin: 30px 0;">
                  <p style="font-size: 12px; color: #777;">Thank you for using Study Tracker!<br>The Study Tracker Team</p>
                </div>
              </div>
            `,
          };

          await transporter.sendMail(mailOptions);
          console.log(`Milestone email sent to ${user.email}`);
        }
      }
    }

    res.json({ message: "Study data saved successfully!" });
  } catch (error) {
    console.error("Error saving study data:", error);
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
app.get("/donate", (req, res) => {
  res.sendFile(__dirname + "/donate.html");
});

app.post("/donate", async (req, res) => {
  try {
    const { amount, email } = req.body;
    console.log("Received donation request:", req.body); // Debug log

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Donation",
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${YOUR_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${YOUR_DOMAIN}/cancel`,
      customer_email: email,
    });

    // Send JSON response instead of redirect
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

app.get("/success", async (req, res) => {
  const sessionId = req.query.session_id; // Get session_id from URL

  if (!sessionId) {
    return res.status(400).send("Session ID is required.");
  }

  try {
    // Retrieve the Checkout Session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Get the Payment Intent ID
    const paymentIntentId = session.payment_intent;

    if (paymentIntentId) {
      // Retrieve Payment Intent details
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      console.log(paymentIntent);

      // Get the Charge ID
      const chargeId = paymentIntent.latest_charge;

      console.log(chargeId);

      // Retrieve Charge details to get the receipt URL
      const charge = await stripe.charges.retrieve(chargeId);

      console.log(charge);

      res.redirect(303, charge.receipt_url);
    } else {
      res.send("Payment successful, but no receipt found.");
    }
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get("/cancel", (req, res) => {
  res.send("Cancelled");
});

// -------------------- GENERATE OTP --------------------
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// -------------------- Temporary Storage for OTPs --------------------
const otpStorage = {};

// -------------------- SEND OTP --------------------
app.post("/send-otp", async (req, res) => {
  console.log("Received OTP request:", req.body);
  const { email } = req.body;

  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email not registered." });
    }

    const otp = generateOTP();
    console.log(`Generated OTP for ${email}: ${otp}`);

    otpStorage[email] = otp; // Store OTP temporarily

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔐 Password Reset Request - Your OTP Inside",
      html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
                  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      <h2 style="color: #2d89ef;">Password Reset Request</h2>
                      <p>Hello,</p>
                      <p>We received a request to reset your password. Use the following One-Time Password (OTP) to proceed:</p>
                      <p style="font-size: 24px; font-weight: bold; color: #2d89ef; margin: 20px 0;">${otp}</p>
                      <p><strong>This OTP is valid for 10 minutes.</strong></p>
                      <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                      <hr style="margin: 30px 0;">
                      <p style="font-size: 12px; color: #777;">Thank you,<br>The Support Team</p>
                  </div>
              </div>
          `,
    };

    await transporter.sendMail(mailOptions);
    console.log("OTP sent successfully to:", email);
    res.json({ message: "OTP sent to email." });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

// -------------------- OTP VERIFICATION --------------------
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  console.log("Received OTP verification request:", { email, otp });
  console.log("Stored OTP for this email:", otpStorage[email]); // Debugging line

  if (otpStorage[email] && otpStorage[email] === otp) {
    console.log("✅ OTP Matched!");
    delete otpStorage[email]; // Remove OTP after successful verification
    res.json({ message: "OTP verified successfully!" });
  } else {
    console.log("❌ Invalid OTP!");
    res.status(400).json({ message: "Invalid or expired OTP." });
  }
});

// -------------------- RESET PASSWORD --------------------
app.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: "Missing email or password." });
  }

  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    console.log(`🔐 Password reset for: ${email}`);
    res.json({ message: "Password reset successfully!" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Failed to reset password." });
  }
});

// Add refresh token endpoint
app.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
