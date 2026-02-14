const express = require("express");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DATA_FILE = "urlaube.json";

/* ============================
   HILFSFUNKTIONEN
============================ */

// Datei laden
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return { urlaube: [], gesperrt: [] };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Datei speichern
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Datum TT.MM.YYYY
function formatDateDE(dateStr) {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

// Urlaub finden
function findUrlaub(data, name, start, end, status) {
    return data.urlaube.find(
        u =>
            u.name === name &&
            u.start === start &&
            u.end === end &&
            (!status || u.status === status)
    );
}

/* ============================
   ROUTEN
============================ */

// GET: Alle Daten
app.get("/data", (req, res) => {
    res.json(loadData());
});

// POST: Neuen Urlaub beantragen
app.post("/urlaub", (req, res) => {
    const { name, dienstnummer, start, end, type, grund } = req.body;

    if (!name || !dienstnummer || !start || !end || !grund) {
        return res.status(400).json({ error: "Alle Felder sind Pflicht!" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (endDate < startDate) {
        return res.status(400).json({
            error: "Enddatum darf nicht vor Startdatum liegen"
        });
    }

    const diffDays =
        (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;

    const minDays = type === "longVacationForm" ? 20 : 4;
    const maxDays = type === "longVacationForm" ? 40 : 14;

    if (diffDays < minDays) {
        return res.status(400).json({
            error: `Mindestdauer ${minDays} Tage`
        });
    }

    if (diffDays > maxDays) {
        return res.status(400).json({
            error: `Maximaldauer ${maxDays} Tage`
        });
    }

    const data = loadData();

    // Prüfen ob Name bereits aktiven Urlaub hat
    const aktive = data.urlaube.find(
        u =>
            u.name === name &&
            (u.status === "eingereicht" ||
                u.status === "genehmigt")
    );

    if (aktive) {
        return res.status(400).json({
            error: `Ein aktiver Urlaub besteht noch bis zum ${formatDateDE(
                aktive.end
            )}`
        });
    }

    // Dienstnummer gesperrt?
    if (data.gesperrt.includes(dienstnummer)) {
        return res
            .status(400)
            .json({ error: "Dienstnummer ist gesperrt" });
    }

    data.urlaube.push({
        name,
        dienstnummer,
        start,
        end,
        type,
        grund,
        status: "eingereicht"
    });

    saveData(data);
    res.json({ success: true });
});

// POST: Genehmigen
app.post("/genehmigen", (req, res) => {
    const { name, start, end } = req.body;
    const data = loadData();

    const urlaub = findUrlaub(
        data,
        name,
        start,
        end,
        "eingereicht"
    );

    if (!urlaub) {
        return res
            .status(400)
            .json({ error: "Urlaub nicht gefunden" });
    }

    urlaub.status = "genehmigt";
    saveData(data);

    res.json({ success: true });
});

// POST: Ablehnen
app.post("/ablehnen", (req, res) => {
    const { name, start, end } = req.body;
    const data = loadData();

    const urlaub = findUrlaub(
        data,
        name,
        start,
        end,
        "eingereicht"
    );

    if (!urlaub) {
        return res
            .status(400)
            .json({ error: "Urlaub nicht gefunden" });
    }

    urlaub.status = "abgelehnt";
    saveData(data);

    res.json({ success: true });
});

// POST: Einzelnen Zeitraum löschen
app.post("/loeschen", (req, res) => {
    const { name, start, end } = req.body;
    const data = loadData();

    const initialLength = data.urlaube.length;

    data.urlaube = data.urlaube.filter(
        u =>
            !(
                u.name === name &&
                u.start === start &&
                u.end === end
            )
    );

    if (data.urlaube.length === initialLength) {
        return res
            .status(400)
            .json({ error: "Urlaub nicht gefunden" });
    }

    saveData(data);
    res.json({ success: true });
});

// POST: Dienstnummer sperren / entsperren
app.post("/sperre", (req, res) => {
    const { dienstnummer } = req.body;
    const data = loadData();

    if (!dienstnummer) {
        return res
            .status(400)
            .json({ error: "Dienstnummer fehlt" });
    }

    if (data.gesperrt.includes(dienstnummer)) {
        data.gesperrt = data.gesperrt.filter(
            d => d !== dienstnummer
        );
    } else {
        data.gesperrt.push(dienstnummer);
    }

    saveData(data);
    res.json({ success: true });
});

app.listen(PORT, () =>
    console.log(`Server läuft auf Port ${PORT}`)
);
