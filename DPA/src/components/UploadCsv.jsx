import React, { useState } from 'react';
import axios from 'axios';

const UploadCsv = () => {
    const [file, setFile] = useState(null);
    const [forecastData, setForecastData] = useState([]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) {
            alert("Bitte wähle eine CSV-Datei aus.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await axios.post("http://127.0.0.1:8000/upload_csv/", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            console.log("Vorhersage erhalten:", response.data);
            setForecastData(response.data);

        } catch (error) {
            console.error("Upload fehlgeschlagen:", error);
            alert("Fehler beim Upload der Datei.");
        }
    };

    return (
        <div>
            <h2>CSV Datei hochladen</h2>
            <input type="file" accept=".csv" onChange={handleFileChange} />
            <button onClick={handleUpload}>Upload</button>

            {/* Vorschau der Daten */}
            {forecastData.length > 0 && (
                <div>
                    <h3>Vorhersage:</h3>
                    <ul>
                        {forecastData.map((item, index) => (
                            <li key={index}>{item.ds} ➔ {item.yhat.toFixed(2)}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default UploadCsv;
