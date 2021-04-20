const express = require("express");
const userRouter = express.Router();
const passport = require("passport");
const passportConfig = require("../passport");
const JWT = require("jsonwebtoken");
const User = require("../models/User");
const Penaltie = require("../models/Penaltie");
const nodemailer = require("nodemailer");
const { update } = require("../models/User");

//  sign token
const signToken = (userID) => {
  return JWT.sign(
    {
      iss: "TahaSrhayarSecret",
      sub: userID,
    },
    "TahaSrhayarSecret",
    { expiresIn: "1h" }
  );
};

// registre
userRouter.post("/registre", (req, res) => {
  const {
    username,
    firstname,
    lastname,
    email,
    password,
    phone,
    adress,
    drivingLicense,
    role,
  } = req.body;
  User.findOne({ username }, (err, user) => {
    if (err) res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
    if (user)
      res.status(400).json({ message: { msgBody: "Username is already taken", msgError: true } });
    else {
      User.findOne({ email }, (err, user) => {
        if (err)
          res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
        if (user)
          res.status(400).json({ message: { msgBody: "email is already taken", msgError: true } });
        else {
          const token = JWT.sign({ username, email }, process.env.JWT_ACC_ACTIVATE, {
            expiresIn: "7d",
          });

          // Step 1
          let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL,
              pass: process.env.PASSWORD,
            },
          });

          // Step 2
          let mailOptions = {
            from: "tahasrhayar2@gmail.com",
            to: email,
            subject: "Nodemailer - Test",
            html: `
              <h2>Click To Confirm Your Account</h2>
              <p>${process.env.CLIENT_URL}/user/email-activate/${token}</p>
            `,
          };

          // Step 3
          transporter.sendMail(mailOptions, (err, data) => {
            if (err) {
              return console.log("Error occurs", err);
            }
            return res.json({ message: "Email has been sent, Activate your account" });
          });

          const newUser = new User({
            username,
            firstname,
            lastname,
            email,
            password,
            phone,
            adress,
            drivingLicense,
            role,
          });

          newUser.save((err) => {
            if (err)
              res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
            else
              res.status(201).json({
                message: {
                  msgBody: "Email has been sent, Activate your account",
                  msgError: false,
                },
              });
          });
        }
      });
    }
  });
});

// valid email
userRouter.get("/email-activate/:token", (req, res) => {
  const { token } = req.params;

  if (token) {
    JWT.verify(token, process.env.JWT_ACC_ACTIVATE, function (err, decodedToken) {
      if (err) return res.status(400).json({ error: "Incorrect or expired link" });

      const { username, email } = decodedToken;
      User.findOne({ username, email }, (err, user) => {
        const { _id } = user;
        if (err)
          res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
        User.findOne(_id, function (err, user) {
          const { _id } = user;
          if (user) {
            User.findByIdAndUpdate(_id, { isActive: 1 }, (err, doc) => {
              if (err)
                res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
              res.json({ message: "Account Activated" });
            });
          } else {
          }
        });
      });
    });
  } else {
    return res.json({ message: "Something went wrong !!" });
  }
});

// login
userRouter.post("/login", passport.authenticate("local", { session: false }), (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.isActive) {
      const { _id, username, role } = req.user;
      const token = signToken(_id);
      res.cookie("access_token", token, { httpOnly: true, sameSite: true });
      res.status(200).json({ isAuthenticated: true, user: { username, role } });
    } else {
      res.json({ message: "You are not active" });
    }
  }
});

// logout
userRouter.get("/logout", passport.authenticate("jwt", { session: false }), (req, res) => {
  res.clearCookie("access_token");
  res.json({ user: { username: "", role: "" }, success: true });
});

// create todo
userRouter.post("/penaltie", passport.authenticate("jwt", { session: false }), (req, res) => {
  if (req.user.role === "admin") {
    const penaltie = new Penaltie(req.body);
    penaltie.save((err, doc) => {
      if (err) res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
      else {
        User.findById(req.body.user, (err, user) => {
          user.penalties.push(penaltie);
          user.save((err) => {
            if (err)
              res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
            else {
              res
                .status(200)
                .json({ message: { msgBody: "Successfully created penaltie", msgError: false } });

              // Step 1
              let transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                  user: process.env.EMAIL,
                  pass: process.env.PASSWORD,
                },
              });

              // Step 2
              let mailOptions = {
                from: "tahasrhayar2@gmail.com",
                to: user.email,
                subject: "Nodemailer - Test",
                html: `
                    <h1>New Penaltie</h1>
                    <p>The type of violation: ${doc.name} .</p>
                    <p>The number of missing points: ${doc.points} .</p>
                  `,
              };

              // Step 3
              transporter.sendMail(mailOptions, (err, data) => {
                if (err) {
                  return console.log("Error occurs", err);
                }
                return res.json({ message: "Email sent to user" });
              });
            }
          });
        });
      }
    });
  } else
    res.status(403).json({ message: { msgBody: "You're not an admin,go away", msgError: true } });
});

// read penalties of this user
userRouter.get("/penaltie", passport.authenticate("jwt", { session: false }), (req, res) => {
  User.findById({ _id: req.user._id })
    .populate("penalties")
    .exec((err, doc) => {
      if (err) res.status(500).json({ message: { msgBody: "Error has occured", msgError: true } });
      else {
        res.status(200).json({ penalties: doc.penalties, authenticated: true });
      }
    });
});

// delete todo
userRouter.delete(
  "/deletepenaltie/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { id } = req.params;
    Todo.findByIdAndDelete(id)
      .then((data) => res.json({ message: "Todo deleted", data }))
      .catch((err) => res.status(400).json("Error: " + err));
  }
);

//############################//

// if admin
userRouter.get("/admin", passport.authenticate("jwt", { session: false }), (req, res) => {
  if (req.user.role === "admin") {
    res.status(200).json({ message: { msgBody: "You are an admin", msgError: false } });
  } else
    res.status(403).json({ message: { msgBody: "You're not an admin,go away", msgError: true } });
});

// if authentifier
userRouter.get("/authenticated", passport.authenticate("jwt", { session: false }), (req, res) => {
  const { username, role } = req.user;
  res.status(200).json({ isAuthenticated: true, user: { username, role } });
});

module.exports = userRouter;
