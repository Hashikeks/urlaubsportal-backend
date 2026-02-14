const express = require("express");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = "urlaube.json";

// Datei laden
function loadData() {
    if (!fs.existsSync(DATA_FILE)) return { urlaube: [], gesperrt: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Datei speichern
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET: alle Urlaube + gesperrte Dienstnummern
app.get("/data", (req, res) => {
    const data = loadData();
    res.json(data);
});

// POST: neuen Urlaub hinzufügen
app.post("/urlaub", (req, res) => {
    const { name, dienstnummer, start, end, type, grund } = req.body;
    if(!name || !dienstnummer || !start || !end || !grund){
        return res.status(400).json({ error: "Alle Felder sind Pflicht!" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = (endDate - startDate)/(1000*60*60*24) + 1;

    let maxDays = type === "longVacationForm" ? 40 : 14;
    let minDays = type === "longVacationForm" ? 20 : 3;

    if(endDate < startDate) return res.status(400).json({ error:"Enddatum darf nicht vor Startdatum liegen" });
    if(diffDays < minDays) return res.status(400).json({ error:`Mindestdauer ${minDays} Tage` });
    if(diffDays > maxDays) return res.status(400).json({ error:`Maximaldauer ${maxDays} Tage` });

    const data = loadData();

    // Prüfen ob Dienstnummer gesperrt ist
    if(data.gesperrt.includes(dienstnummer)) return res.status(400).json({ error:"Urlaub für diese Dienstnummer gesperrt" });

    data.urlaube.push({ name, dienstnummer, start, end, type, grund, status:"eingereicht" });
    saveData(data);
    res.json({ success:true });
});

// POST: Urlaub genehmigen
app.post("/genehmigen", (req,res)=>{
    const { dienstnummer } = req.body;
    const data = loadData();
    let gefunden=false;
    data.urlaube.forEach(u=>{
        if(u.dienstnummer===dienstnummer && u.status==="eingereicht"){
            u.status="genehmigt";
            gefunden=true;
        }
    });
    if(!gefunden) return res.status(400).json({error:"Urlaub nicht gefunden"});
    saveData(data);
    res.json({ success:true });
});

// POST: Urlaub löschen
app.post("/loeschen", (req,res)=>{
    const { dienstnummer } = req.body;
    const data = loadData();
    const initialLength = data.urlaube.length;
    data.urlaube = data.urlaube.filter(u=>u.dienstnummer!==dienstnummer);
    if(data.urlaube.length===initialLength) return res.status(400).json({ error:"Urlaub nicht gefunden" });
    saveData(data);
    res.json({ success:true });
});

// POST: Dienstnummer sperren/entsperren
app.post("/sperre", (req,res)=>{
    const { dienstnummer } = req.body;
    const data = loadData();
    if(data.gesperrt.includes(dienstnummer)){
        data.gesperrt = data.gesperrt.filter(d=>d!==dienstnummer);
    } else {
        data.gesperrt.push(dienstnummer);
    }
    saveData(data);
    res.json({ success:true });
});

app.listen(PORT, ()=> console.log(`Server läuft auf Port ${PORT}`));
