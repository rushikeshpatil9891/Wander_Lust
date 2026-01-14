const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");

const ExpressError = require("./utils/ExpressError.js");
const {listingSchema , reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
    .then( ()=>{
        console.log("Connected to DB");
    })
    .catch((err)=>{
        console.log(err);
    });

async function main(){
    await mongoose.connect(MONGO_URL);
}

app.set("view engine" , "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname,"/public")));

app.get("/" , (req,res)=>{
    res.redirect("/listings");
});

const validateListing = (req , res , next) => {
    let {error} = listingSchema.validate(req.body);

    if(error){
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400 , errmsg);
    }else{
        next();
    }
};

const validateReview = (req , res , next) => {
    let {error} = reviewSchema.validate(req.body);

    if(error){
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400 , errmsg);
    }else{
        next();
    }
};

//New Route
app.get("/listings/new" , (req ,res) =>{
    res.render("listings/new.ejs");
});

app.get("/listings/:id", wrapAsync(async (req,res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id).populate('reviews');
    res.render("./listings/show.ejs" , {listing});
}));

//Index Route
app.get("/listings" , wrapAsync(async (req , res) =>{
    const allListings = await Listing.find({});
    res.render("./listings/index.ejs",{allListings});
}));

// Search Route
app.get("/search", wrapAsync(async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.redirect("/listings");
    }
    
    // Search in title, description, location, and country
    const searchResults = await Listing.find({
        $or: [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { location: { $regex: query, $options: 'i' } },
            { country: { $regex: query, $options: 'i' } }
        ]
    });
    
    res.render("./listings/index.ejs", { allListings: searchResults, searchQuery: query });
}));

//Create Route
app.post("/listings",validateListing , wrapAsync(async (req , res , next)=>{
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    res.redirect("/listings");
}));

//Edit Route
app.get("/listings/:id/edit", wrapAsync(async (req , res)=>{
    let {id} = req.params;
    const listing = await Listing.findById(id);
    res.render("./listings/edit.ejs", {listing});
}));

//Update Route
app.put("/listings/:id" ,validateListing , wrapAsync(async (req , res) =>{
    let { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(id , {...req.body.listing}, {new: true});
    res.redirect(`/listings/${id}`);
}));

//Delete Route
app.delete("/listings/:id" , wrapAsync(async(req , res )=>{
    let { id } = req.params;
    let deleteListing = await Listing.findByIdAndDelete(id);
    console.log(deleteListing);
    res.redirect("/listings");
}));

// Review
// Post Route
app.post("/listings/:id/reviews" , validateReview ,wrapAsync(async(req , res)=>{
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);

    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

    res.redirect(`/listings/${listing._id}`);

    // console.log("new review saved");
    // res.send("new review saved");
}));

// Delete Review Route
app.delete("/listings/:id/reviews/:reviewId", wrapAsync(async (req, res) => {
    let { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/listings/${id}`);
}));

// app.get("/testListing",async ( req , res ) => {
//     let sampleListing = new Listing(
//         {
//         title: "My new villa",
//         discription:"By the Beach",
//         price:1200,
//         location:"Calangute, Goa",
//         country:"India",
//         }
//     );

//     sampleListing.save();
//     console.log("sample was saved");
//     res.send("Test Successful");
// });

app.all("*" , (req , res , next) =>{
    next(new ExpressError(404 , "Page not found"));
});

app.use((err , req , res ,next) =>{
    let {statusCode=500 , message="Something went Wrong"} = err;
    res.status(statusCode).render("error.ejs" , {message});
    // res.status(statusCode).send(message);
    // res.send("Something went Wrong");
});

app.listen(8080, () =>{
    console.log("App is listening on port 8080.");
});