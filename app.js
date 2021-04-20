const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const morgan = require("morgan");
require("dotenv").config();

app.use(cookieParser());
app.use(express.json());
app.use(morgan("tiny"));

mongoose.connect(
  "mongodb://localhost:27017/electronpermis",
  { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false },
  () => {
    console.log("successfully connected to database");
  }
);

mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);

const userRouter = require("./routes/User");
app.use("/user", userRouter);

const port = process.env.PORT || 7000;

app.listen(process.env.PORT, () => {
  console.log("express server started at", port);
});
