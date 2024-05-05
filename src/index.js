import dotenv from "dotenv";
import connectDB from "../db/index.js";
import { app } from "./app.js";

dotenv.config({
    path:'./env'
});
// we use import statement for dotenv and set config path in it, and now we will use experimental fetaure by adding some commands in run script -r dotenv/confiq --experimental-json-modules

connectDB()
.then((result) => {
    app.on("error", (error)=>{
        console.log('eror--', error);
        throw error;
    })
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`server is listen on PORT: ${process.env.PORT}`)
    });
}).catch((err) => {
    console.log("MOngoDb connection Failed");    
});




// this is aproach a but we are chgoosing aproach b to setup connection and app diff files
/*  
import { DB_NAME } from "./constant";
import express from "express";
const app = express();

;(async()=>{
    try {
        mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error)=>{
            console.log("ERROR", error);
            throw error;
        })

        app.listen(process.env.PORT, ()=>{
            console.log(`app is listining on PORT ${Process.env.PORT}`)
        })
    } catch (error) {
        console.log("ERROR", error);
    }
})() */