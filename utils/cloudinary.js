import {v2 as cloudinary} from 'cloudinary';
import fs from "fs";
          
cloudinary.config({ 
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME, 
  api_key:  process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const upploadOnCloudinary = async(localPath)=>{
    try {
        if(!localPath) return null;
        //upload filepath to cloudinary
        const response = await cloudinary.uploader.upload(localPath,
            { resource_type: 'auto'})

        // file succesfully upload
        // console.log('file succesfully upload', response.url);
        fs.unlinkSync(localPath); //remove completely then return response;
        return response;
    } catch (error) {
        fs.unlinkSync(localPath) // remove file from temp folder as upload opertaion got failed to dobara se reupload kro local m v or clod p bhi
        return null;
    }
}

export {upploadOnCloudinary};
