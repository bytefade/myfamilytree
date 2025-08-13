const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// String de conexão do MongoDB Atlas (substitua com a sua)
const uri =
  "mongodb+srv://familyuser:a5yeQstKrSpvoguh@cluster0.dwmk1z0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Conectado ao MongoDB!");
  } catch (error) {
    console.error("Erro ao conectar ao MongoDB:", error);
  }
}

connectToDatabase();

const db = client.db("myfamilydb");
const membersCollection = db.collection("members");

// Listar todos os membros
app.get("/members", async (req, res) => {
  try {
    const members = await membersCollection.find().toArray();
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar membros" });
  }
});

// Adicionar um novo membro
app.post("/members", async (req, res) => {
  const newMember = req.body;
  try {
    // Verificar duplicatas por Nome e Parentesco
    const existing = await membersCollection.findOne({
      name: { $regex: `^${newMember.name}$`, $options: "i" },
      relationship: newMember.relationship,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Já existe um membro com esse nome e parentesco!" });
    }
    // Atualizar relações de parentes existentes
    if (newMember.parentId) {
      const parentIdStr = String(newMember.parentId);
      const parent = await membersCollection.findOne({ id: parentIdStr });
      if (parent) {
        console.log(
          `Atualizando childrenIds de ${parentIdStr} com ${newMember.id}`,
        );
        await membersCollection.updateOne(
          { id: parentIdStr },
          { $push: { childrenIds: newMember.id } },
          { upsert: false },
        );
        newMember.parentIds = [parentIdStr];
      } else {
        console.log(`Pai com id ${parentIdStr} não encontrado`);
        newMember.parentIds = [];
      }
    } else {
      newMember.parentIds = [];
    }
    // Atualizar siblings (irmãos) se houver parentId
    if (newMember.parentIds.length) {
      const siblings = await membersCollection
        .find({ parentIds: newMember.parentIds[0] })
        .toArray();
      newMember.siblingsIds = siblings
        .filter((s) => s.id !== newMember.id)
        .map((s) => s.id);
      console.log(`Siblings de ${newMember.id}:`, newMember.siblingsIds);
      await membersCollection.updateMany(
        { id: { $in: newMember.siblingsIds } },
        { $push: { siblingsIds: newMember.id } },
      );
    } else {
      newMember.siblingsIds = [];
    }
    // Adicionar o novo membro
    newMember.validated = true;
    newMember.relationships = [];
    const result = await membersCollection.insertOne(newMember);
    console.log(`Membro ${newMember.id} adicionado com sucesso`);
    res.status(201).json(newMember);
  } catch (error) {
    console.error("Erro ao adicionar membro:", error);
    res.status(500).json({ message: "Erro ao adicionar membro" });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
