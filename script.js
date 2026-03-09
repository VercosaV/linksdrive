const defaultLinks=[

{title:"ChatGPT",url:"https://chatgpt.com",category:"IA"},
{title:"Gemini",url:"https://gemini.google.com/app",category:"IA"},
{title:"Manus",url:"https://manus.im/app",category:"IA"},
{title:"DeepSeek",url:"https://chat.deepseek.com/sign_in",category:"IA"},

{title:"Vercel",url:"https://vercel.com",category:"Dev"},
{title:"Supabase",url:"https://supabase.com/dashboard",category:"Dev"},
{title:"AWS",url:"https://aws.amazon.com",category:"Dev"},
{title:"JSON Formatter",url:"https://jsonformatter.curiousconcept.com",category:"Dev"},
{title:"Diagrams",url:"https://app.diagrams.net",category:"Dev"},
{title:"GitHub",url:"https://github.com",category:"Dev"},

{title:"Teams",url:"https://teams.microsoft.com/v2",category:"Faculdade"},
{title:"SIGA",url:"https://siga.cps.sp.gov.br/sigaaluno/applogin.aspx",category:"Faculdade"},

{title:"Alura",url:"https://cursos.alura.com.br",category:"Cursos"},
{title:"DIO",url:"https://web.dio.me",category:"Cursos"},
{title:"Circle",url:"https://login.circle.so",category:"Cursos"},
{title:"Estudar",url:"https://ead.estudar.org.br/users/sign_in",category:"Cursos"},
{title:"Curso Unity",url:"https://cursos.dankicode.com/unity",category:"Cursos"},
{title:"Curso Laravel",url:"https://www.cursou.com.br/informatica/programacao/php/laravel-framework-php-desenvolvimento-web",category:"Cursos"},

{title:"Song BPM",url:"https://getsongbpm.com",category:"Música"},
{title:"Violino",url:"https://canalparaviolinistas.com/downloads",category:"Música"},

{title:"Aspire Leaders",url:"https://engage.aspireleaders.org/profile",category:"Networking"},
{title:"LinkedIn",url:"https://www.linkedin.com/feed",category:"Networking"},

{title:"RetroGames",url:"https://www.retrogames.onl",category:"Jogos"},
{title:"Game3rb",url:"https://game3rb.com/category/games-online",category:"Jogos"},
{title:"Nexus Mods",url:"https://www.nexusmods.com/skyrim/mods/116605",category:"Jogos"},
{title:"WarriorJS",url:"https://warriorjs.com",category:"Jogos"},
{title:"Guia Monster Hunter",url:"https://guiadomh.carrd.co",category:"Jogos"}

]

let customLinks=JSON.parse(localStorage.getItem("links"))||[]

const container=document.getElementById("linksContainer")

function getAllLinks(){
return [...defaultLinks,...customLinks]
}

function saveStorage(){
localStorage.setItem("links",JSON.stringify(customLinks))
}

function renderLinks(filter=""){

container.innerHTML=""

const links=getAllLinks()

const categories=[...new Set(links.map(l=>l.category))]

categories.forEach(cat=>{

const title=document.createElement("div")
title.className="category"
title.innerText=cat

container.appendChild(title)

links
.filter(l=>l.category===cat)
.filter(l=>l.title.toLowerCase().includes(filter.toLowerCase()))

.forEach(link=>{

const card=document.createElement("div")
card.className="card"

const domain=new URL(link.url).hostname

card.innerHTML=`

<img src="https://www.google.com/s2/favicons?domain=${domain}">

<a href="${link.url}" target="_blank">${link.title}</a>

<button onclick="deleteLink('${link.id}')">Excluir</button>

`

container.appendChild(card)

})

})

}

function addLink(){

const link={

id:Date.now(),

title:document.getElementById("titleInput").value,
url:document.getElementById("urlInput").value,
category:document.getElementById("categoryInput").value

}

customLinks.push(link)

saveStorage()

document.getElementById("modal").style.display="none"

renderLinks()

}

function deleteLink(id){

customLinks=customLinks.filter(l=>l.id!=id)

saveStorage()

renderLinks()

}

document
.getElementById("addBtn")
.onclick=()=>{

document.getElementById("modal").style.display="flex"

}

document
.getElementById("saveLink")
.onclick=addLink

document
.getElementById("search")
.addEventListener("input",(e)=>{

renderLinks(e.target.value)

})

renderLinks()