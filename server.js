require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const StudySchema = new mongoose.Schema({
  studyData: String,
  timestamp: { type: Date, default: Date.now },
});

const StudyModel = mongoose.model("Study", StudySchema);

app.post("/saveStudyData", async (req, res) => {
  try {
    const newData = new StudyModel({ studyData: req.body.studyData });
    await newData.save();
    res.json({ message: "Study data saved successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Error saving data" });
  }
});

app.get("/getStudyData", async (req, res) => {
  try {
    const data = await StudyModel.find().sort({ timestamp: -1 }).limit(1);
    res.json(data.length ? data[0] : { studyData: "No data found" });
  } catch (error) {
    res.status(500).json({ error: "Error fetching data" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
