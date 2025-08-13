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
    // Inicializar arrays
    newMember.parentIds = newMember.parentId
      ? [String(newMember.parentId)]
      : [];
    newMember.childrenIds = [];
    newMember.siblingsIds = [];
    newMember.relationships = [];

    // Adicionar o novo membro primeiro
    newMember.validated = true;
    const result = await membersCollection.insertOne(newMember);
    console.log(
      `Membro ${newMember.id} adicionado com sucesso, relationships: ${newMember.relationships}`,
    );

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
        // Recalcular relationships do pai após a inserção
        const updatedParent = await membersCollection.findOne({
          id: parentIdStr,
        });
        console.log(
          `childrenIds do pai ${parentIdStr} após atualização: ${updatedParent.childrenIds}`,
        );
        if (
          updatedParent &&
          updatedParent.childrenIds &&
          updatedParent.childrenIds.length > 0
        ) {
          const parentRelationships = [];
          const children = await membersCollection
            .find({ id: { $in: updatedParent.childrenIds } })
            .toArray();
          console.log(`Filhos encontrados para ${parentIdStr}:`, children);
          if (children.length > 0) {
            children.forEach((child) => {
              // Determinar a relação correta com base no parentesco do filho
              let relation = "";
              if (
                child.relationship === "Filho" ||
                child.relationship === "Pai"
              ) {
                relation = "pai";
              } else if (
                child.relationship === "Filha" ||
                child.relationship === "Mãe"
              ) {
                relation = "mãe";
              } else {
                relation = updatedParent.relationship.toLowerCase(); // Fallback para outros casos
              }
              parentRelationships.push(`${relation} de ${child.name}`);
            });
            await membersCollection.updateOne(
              { id: parentIdStr },
              { $set: { relationships: parentRelationships } },
            );
            console.log(
              `Relações do pai ${parentIdStr} atualizadas: ${parentRelationships}`,
            );
          } else {
            console.log(
              `Nenhum filho encontrado para ${parentIdStr} apesar de childrenIds: ${updatedParent.childrenIds}`,
            );
          }
        } else {
          console.log(`childrenIds vazio ou nulo para ${parentIdStr}`);
        }
      } else {
        console.log(`Pai com id ${parentIdStr} não encontrado`);
      }
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
    }

    // Calcular relationships do novo membro após inserção
    const relationships = [];
    if (newMember.parentIds.length) {
      const parent = await membersCollection.findOne({
        id: newMember.parentIds[0],
      });
      if (parent) {
        relationships.push(`Filho de ${parent.name}`);
      }
    }
    if (newMember.childrenIds.length) {
      const children = await membersCollection
        .find({ id: { $in: newMember.childrenIds } })
        .toArray();
      children.forEach((child) => {
        relationships.push(
          `${newMember.relationship.toLowerCase()} de ${child.name}`,
        );
      });
    }
    await membersCollection.updateOne(
      { id: newMember.id },
      { $set: { relationships: relationships } },
    );
    console.log(
      `Relações do novo membro ${newMember.id} atualizadas: ${relationships}`,
    );

    res.status(201).json(newMember);
  } catch (error) {
    console.error("Erro ao adicionar membro:", error);
    res.status(500).json({ message: "Erro ao adicionar membro" });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
