const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Substitua pela sua string de conexão do MongoDB
const mongoURI =
  "mongodb+srv://familyuser:a5yeQstKrSpvoguh@cluster0.dwmk1z0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Conectado ao MongoDB"))
  .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// Schema para People
const personSchema = new mongoose.Schema({
  id: String,
  name: String,
  birthDate: String,
  avatar: String,
  parentIds: [String],
  childrenIds: [String],
  siblingsIds: [String],
  validated: Boolean,
  relationships: [String],
});
const Person = mongoose.model("Person", personSchema);

// Endpoint para listar pessoas
app.get("/people", async (req, res) => {
  try {
    const people = await Person.find();
    res.json(people);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Endpoint para adicionar pessoa
app.post("/people", async (req, res) => {
  const person = new Person(req.body);
  try {
    const newPerson = await person.save();
    res.status(201).json(newPerson);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Endpoint para atualizar relações de uma pessoa
app.patch("/people/:id", async (req, res) => {
  try {
    const person = await Person.findOneAndUpdate(
      { id: req.params.id },
      { relationships: req.body.relationships },
      { new: true, runValidators: true },
    );
    if (!person)
      return res.status(404).json({ message: "Pessoa não encontrada" });
    res.json(person);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
