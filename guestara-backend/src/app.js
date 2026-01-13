const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const routes = require("./routes");
const { errorHandler } = require("./common/middleware/errorHandler");

const app = express();

// MIddlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api", routes);


app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
