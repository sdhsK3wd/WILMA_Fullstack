// src/components/PageTransition.tsx
import React from "react";
import { motion } from "framer-motion";

const fadeVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <motion.div
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            style={{ height: "100%" }}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
