// src/components/PageSpinner.tsx
import React from "react";
import { ClipLoader } from "react-spinners";

const PageSpinner: React.FC = () => {
    return (
        <div
            style={{
                height: "100vh",
                backgroundColor: "#f9f9f9",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <ClipLoader size={26} color="#4a90e2" />
        </div>
    );
};

export default PageSpinner;
