import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app =express();

app.use(cors({  // app.use(cors())
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// app.use(express.json()) we are using this to handle json and we can set some limits also;
app.use(express.json({
    limit:"16kb"  // jb form fill kiya to json se data aaya uska limit;
}))

// url m jo data jat a h usko handle krna
app.use(express.urlencoded({extended:true, limit:"16kb"}))

// to staore some static file or img or icon in our server
app.use(express.static("public"))

//just use to read and perform opertaion from server to user's cookies
app.use(cookieParser())

export { app };

