const express=require('express');const path=require('path');const app=express();
app.use(express.static(path.join(__dirname,'public'),{maxAge:'7d',setHeaders:(res,p)=>{if(p.endsWith('index.html'))res.setHeader('Cache-Control','no-cache')}}));
app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(process.env.PORT||3000,()=>console.log('louiza up'));
