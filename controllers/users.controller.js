import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { upploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async(req,res,next)=>{
    // get details from frontend
    // validation like not empty
    // check if user already exist username and email
    // check for images / check for avatar
    //upload them to cloudinary
    // check avatar upload on multer/cloudinary sucessfull, if yes then remove from local;
    // create user object- create entry in db
    // remove password and refresh token field from reponse to fronend like agar profile m show krna hoga to
    // return res

    const { userName,email, fullName, password } = req.body;

    if ([fullName,email,userName,password].some((field)=>
        field?.trim() == ""
    )){
        throw new ApiError(400,"all fields are required");
    }

    const existedUser = await User.findOne({ //check db m username or email to nhi h
        $or: [{ userName }, { email }]  // $or operator use kiya h array m jitni value check krni h krega object k andar alag alag
    })
    if (existedUser){
        throw new ApiError(409, "User with Email already exist");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path; // req.files multer se aaya h

    // const coverImageLocalPath = req.files?.coverImage[0]?.path; // t gives error if coverimage is not there

    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    if (!avatarLocalPath){
        throw new ApiError(400, "avatar file is required");
    }

    //upload o cloudinary;

    const avatar = await upploadOnCloudinary(avatarLocalPath);
    const coverImage = await upploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "avatar is not uploaded on cloudinary")
    }

    //create user

    const user = await User.create({ //user schema se bola k user create kr do
        fullName,
        userName: userName.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password

    })

    //test user created or not
    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"  // except these two field all user data can be sent to frontend
    )
    if (!userCreated){
        throw new ApiError(500, "something went wrong while registering user")
    }

    return res.status(201).json( // data return(res) to frontend
       new ApiResponse(200, userCreated, "user registered successfully")
    );




    // res.status(200).json({
    //     message:"ok",
    // })
})

export { registerUser};