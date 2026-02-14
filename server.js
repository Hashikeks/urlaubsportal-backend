const express = require("express");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = "urlaube.json";

// Hilfsfunktion: Datei laden
function loadData() {
    if (!fs.existsSync(DATA_FILE)) return { urlaube: [], gesperrt: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Hilfsfunktion: Datei speichern
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- GET: alle Urlaube + gesperrte Dienstnummern
app.get("/data", (req, res) => {
    const data = loadData();
    res.json(data);
});

// --- POST: neuen Urlaub hinzufügen
app.post("/urlaub", (req, res) => {
    const { name, dienstnummer, start, end, type } = req.body;
    if (!name || !dienstnummer || !start || !end) return res.status(400).json({ error: "Ungültige Daten" });

    const data = loadData();

    // Prüfen ob bereits aktiver/genehmigter Urlaub
    const aktive = data.urlaube.find(u=>u.dienstnummer===dienstnummer && (u.status==="eingereicht" || u.status==="genehmigt"));
    if(aktive) return res.status(400).json({ error: `Ein aktiver Urlaub besteht noch bis zum ${aktive.end}` });

    if(data.gesperrt.includes(dienstnummer)) return res.status(400).json({ error: "Gespräch offen – Urlaub gesperrt" });

    data.urlaube.push({ name, dienstnummer, start, end, type, status:"eingereicht" });
    saveData(data);
    res.json({ success:true });
});

// --- POST: Urlaub genehmigen
app.post("/genehmigen", (req, res) => {
    const { dienstnummer } = req.body;
    const data = loadData();
    let gefunden=false;
    data.urlaube.forEach(u => { 
        if(u.dienstnummer===dienstnummer && u.status==="eingereicht") { 
            u.status="genehmigt"; gefunden=true; 
        }
    });
    if(!gefunden) return res.status(400).json({error:"Urlaub nicht gefunden"});
    saveData(data);
    res.json({ success:true });
});

// --- POST: Dienstnummer sperren/entsperren
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