import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { deleteFromClodinary, upploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async(user_id)=>{ // yhs p normal async use kiya kyuki isi file m handle krenge thoda sa response
try {
    const user = await User.findById(user_id)
    const accessToken = user.generateAccessToken(); //access token created and saved in to variable
    const refreshToken =user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // user.save();  // refresh token saved in db
    //NOTE- when you save something in db mongoose's model gets kicked in, thats mean it will try to find password and try to validate, and others field required true;
    // so we remove validation before save in it
    await user.save({validateBeforeSave: false});
    return {accessToken, refreshToken};

} catch (error) {
    throw new ApiError(500, "something went wrong while creating refreshToken")
}

}

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

const loginUser = asyncHandler(async(req,res,next)=>{
    //get data from req.body
    // validate data( if empty or not, if available username or email in db)
    // find the user
    // password check (jwt and hash things)
    // give access token and refresh token in cookies

   try {
    const {email,password, userName}  = req.body;
 
    if(!(userName || password)){
     throw new ApiError(400, "username or password  required")
    }
    // find user with help of username or email
 const user = await User.findOne({ // note:-- ye user jo hmne db se find kiya h iske pass hmare bnaye custom methods bhi h 'User' ye mongoose se h iske pass custom method nhi h
     $or : [{userName}, {email}]
 })

 if(!user){
     throw new ApiError(400, "user does not exist")
 }
 const isPasswordValid = await user.isPasswordCorrect(password);

 if(!isPasswordValid){
     throw new ApiError(401, "Invalid user credentials")
 }
 const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id); //isem time lg skta h to await lga do
 // hme kuch unwanted cheeje htani h  jo hm get kr rhe h user se to required fields get kr skte h access tocken wali query se hi, 
 // nhi to uperwale user se lenge to usme refresh tocken nhi hoga kyuki us variable m purana data h usme refresh tocken nhi h
 
 const loggedInUser =await User.findById(user._id).select("-password -refreshToken")
 
 // send cookies to frontgend with user info
 const options = {
     httpOnly:true,
     secure:true
 }  // that means option set h cookies ab server se hi modified hongi khi or se nhi
 
 return res.status(200)
 .cookie('accessToken', accessToken, options)
 .cookie('refreshToken',refreshToken,options)
 .json(
     new ApiResponse(200,
         {
             user: loggedInUser, accessToken, refreshToken  // ye isliye bhejte h if frontend apne hisaab se ise handle krna chahe to
         },
         "user logged In sucessfully"
     )
 )
   } catch (error) {
    throw new ApiError(500, error.message || "error in login")
   }

})

const logoutUser = asyncHandler(async(req,res,next)=>{
    // cookies needs to be clear
    // refresh tocken bhi manage krna pdega, nhi to bina login k on bassis of this user can access as login
    User.findByIdAndUpdate(
       await req.user._id,
        {
            $set: {
                refreshToken:undefined
            }
        },
        {
            new: true  // aise kr skte h taki response m Returning the Updated Document
        }
    )
    const options = {
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken',options)
    .json(
        new ApiResponse(200,
            {},
            "user logged out sucessfully"
        )
    )
})

const refreshAcessToken = asyncHandler(async(req,res,next)=>{

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken){
        throw new ApiError('401', "unauthorized request");
    }

    try {
        const decodedToken = jwt.varify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = User.findById(decodedToken?._id);
        if (!user){
            throw new ApiError('401', "Invalid refresh Token");
        }
    
        if(incomingRefreshToken!==user?.refrestToken){
            throw new ApiError('401', "refresh Token is expired or used");
        }
        //generate new token
        // generateAccessAndRefreshToken
        const {accessToken,NewRefreshToken} = await generateAccessAndRefreshToken(user._id); //isem time lg skta h to await lga do
    
        const options = {
            httpOnly:true,
            secure:true
        }  // that means option set h cookies ab server se hi modified hongi khi or se nhi
        
        return res.status(200)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken',NewRefreshToken,options)
        .json(
            new ApiResponse(200,
                {
                 accessToken, refreshToken: NewRefreshToken  // ye isliye bhejte h if frontend apne hisaab se ise handle krna chahe to
                },
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(500, error.message || "Invalid refresh Token") 
    }
})

const currentPasswordChange = asyncHandler(async(req,res,next)=>{ // ye password tbhi change ho skta h jb user loggedIn ho
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id) // auth middleware se user hmare pass h
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword); // means jo existing password diya h vo correct h?
    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid  old password ");
    }
    user.password = newPassword;  // ye user m password field m set kr diya , but save bhi krna hota h
    await user.save({validateBeforeSave:false});
     return res.status(200).json(new ApiResponse(200, {}, "password change successfully"));

})

const getCurrentUser = asyncHandler(async(req,res,next)=>{
    return res.status(200).json(new ApiResponse(200, req.user, "current user fetch sucesfully"));
})

const updateAccountDetails = asyncHandler(async(req,res,next)=>{
    const {email, fullName} = req.body;
    if (!(email || fullName)){
        throw new ApiError(400, "all fields are required");
    }
    const user = await User.findByIdAndUpdate(req.user?._id, //accept 3 parameter
        {
            $set:{
                fullName,
                email:email //aise bhi kr skte h
            }
        },
        {new :true} // agar new true h , to updated info return krta h
    ).select("-password");

    res
    .status(200)
    .json(new ApiResponse(200, user, "account details update succeessfully"));
})

const updateUserAvatar = asyncHandler(async(req,res,next)=>{

    const avatarLocalPath = req.file?.path; // files nhi liya kyuki route m ik hi file upload krne ko di h multer se to hi req.file access kr pa rhe h
    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing");
    }
   try {
     const newAvatar = await upploadOnCloudinary(avatarLocalPath);
     if(!newAvatar){
         throw new ApiError(400, "Error while uploading avatar");
     }
     const user = await User.findById(req.user?._id).select("-password -refreshToken");
     deleteFromClodinary(user.avatar);    
     
     user.avatar = newAvatar?.url;
     await user.save({validateBeforeSave: false});
     res.status(200).json(new ApiResponse(200, user, "avatar image updated successfully"))
   } catch (error) {
    throw new ApiError(400, "Error while uploading avatar")
   }
})
const updateUserCoverImage = asyncHandler(async(req,res,next)=>{

    const coverImageLocalPath = req.file?.path; // files nhi liya kyuki route m ik hi file upload krne ko di h multer se to hi req.file access kr pa rhe h
    if (!coverImageLocalPath){
        throw new ApiError(400, "coverImage file is missing");
    }
    try {
        const newCoverImage = await upploadOnCloudinary(coverImageLocalPath);
        if(!newCoverImage){
            throw new ApiError(400, "Error while uploading cover Image");
        }
        
        const user = await User.findById(req.user?._id).select("-password -refreshToken");
        deleteFromClodinary(user.coverImage);    
        
        user.coverImage = newCoverImage?.url;
        await user.save({validateBeforeSave: false});
        res.status(200).json(new ApiResponse(200, user, "coverImage updated successfully"))
      } catch (error) {
       throw new ApiError(400, "Error while uploading coverImage")
      }
})

export { registerUser, loginUser, logoutUser, refreshAcessToken, currentPasswordChange,getCurrentUser, updateAccountDetails,updateUserAvatar, updateUserCoverImage};