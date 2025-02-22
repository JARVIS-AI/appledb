const cname = 'api.appledb.dev'
const fs = require('fs')
const path = require('path')

function getAllFiles(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)
  arrayOfFiles = arrayOfFiles || []
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })
  return arrayOfFiles
}

function requireAll(p, fileType) {
  return getAllFiles(p)
  .filter(f => f.endsWith(fileType))
  .map(f => require('.' + path.sep + f))
}

function mkdir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p)
}

function write(p, f) {
  fs.writeFileSync(p, f)
  filesWritten++
}

function writeJson(dirName, arr, property) {
  var obj = {}
  arr.map(function(x) { obj[x[property]] = x })

  mkdir(path.join(p, dirName))
  write(path.join(p, dirName, 'index.json'), JSON.stringify(arr.map(x => x[property]), null, 2))
  write(path.join(p, dirName, 'main.json'), JSON.stringify(obj, null, 2))
  arr.map(function(x) { write(path.join(p, dirName, x[property] + '.json'), JSON.stringify(x, null, 2))})

  main[dirName] = obj
}

var iosFiles          = requireAll('iosFiles', '.json'),
    jailbreakFiles    = requireAll('jailbreakFiles', '.js'),
    deviceGroupFiles  = requireAll('deviceGroupFiles', '.json'),
    deviceFiles       = requireAll('deviceFiles', '.json'),
    bypassTweaks      = requireAll('bypassTweaks', '.json'),
    bypassApps        = requireAll('bypassApps', '.json')

deviceFiles = deviceFiles.map(function(dev) {
  if (dev.icon && Array.isArray(dev.icon)) dev.icon = dev.icon.map(ico =>  `https://emiyl.github.io/appleicons/com.apple.${ico}.icns.png`)
  if (dev.model && !Array.isArray(dev.model)) dev.model = [dev.model]
  if (dev.board && !Array.isArray(dev.board)) dev.board = [dev.board]
  if (!dev.model) dev.model = []
  if (!dev.board) dev.board = []
  return dev
})

iosFiles = iosFiles.map(function(ver) {
  if (!ver.uniqueBuild) ver.uniqueBuild = ver.build
  if (!ver.beta) ver.beta = false
  if (!ver.sortVersion) {
    if (ver.iosVersion) ver.sortVersion = ver.iosVersion
    else ver.sortVersion = ver.version
  }
  if (!ver.devices) ver.devices = {}
  
  ver.osType = ver.osStr
  if (ver.osType == 'iPhoneOS' || ver.osType == 'iPadOS') ver.osType = 'iOS'
  if (ver.osType == 'Apple TV Software') ver.osType = 'tvOS'

  ver.appledburl = ['https://appledb.dev',ver.osType,ver.uniqueBuild].join('/') + '.html'

  return ver
})

jailbreakFiles = jailbreakFiles.map(function(jb) {
  if (jb.info.guide) {
    jb.info.guide = jb.info.guide.map(function(g) {
      if ((g.name || g.text) && g.url) {
        if (!g.name) g.name = g.text
        else if (!g.text) g.text = g.name
        g.validGuide = true
      }
      else g.validGuide = false
      g.text = (g.text) ? g.text : 'none'
      g.name = (g.name) ? g.name : 'none'
      g.url = (g.url) ? g.url : ''
      g.pkgman = (g.pkgman) ? g.pkgman : 'none'
      return g
    })
  }
  return jb
})

const buildArr = iosFiles.map(x => x.uniqueBuild)
const uniqueBuildArr = new Set(buildArr)
const duplicateBuildArr = buildArr.filter(x => {
  if (uniqueBuildArr.has(x)) {
    uniqueBuildArr.delete(x);
  } else {
    return x;
  }
})

for (i of duplicateBuildArr) {
  var getObjArr = iosFiles.filter(x => x.uniqueBuild == i)
  for (j of getObjArr) {
    j.uniqueBuild += '-' + j.osType
  }
}

bypassApps = bypassApps.map(function(app) {
  if (!app.bypasses) return JSON.stringify(app)

  app.bypasses = app.bypasses.map(function(b) {
    if (!b.name) return b
    
    var bypassObj = bypassTweaks.filter(t => t.name == b.name)[0]
    if (b.notes) bypassObj.appNotes = b.notes

    return bypassObj
  })

  return JSON.stringify(app)
})

bypassApps = bypassApps.map(x => JSON.parse(x)) // This is extremely dumb but necessary for some reason

const p = 'out'
mkdir(p)
fs.writeFileSync(`${p}/CNAME`, cname)

var main = {}
var filesWritten = 0

writeJson('ios', iosFiles, 'uniqueBuild')
writeJson('jailbreak', jailbreakFiles, 'name')
writeJson('group', deviceGroupFiles, 'name')
writeJson('device', deviceFiles, 'identifier')
writeJson('bypass', bypassApps, 'bundleId')

write(path.join(p, 'main.json'), JSON.stringify(main))

var dirName = path.join(p, 'compat')
mkdir(dirName)
iosFiles.map(function(fw) {
  if (fw.devices) Object.keys(fw.devices).map(function(dev) {
    mkdir(path.join(dirName, dev))
    var jb = jailbreakFiles.filter(function(x) {
      if (x.hasOwnProperty('compatibility')) return x.compatibility.filter(function(y) {
        return y.devices.includes(dev) && y.firmwares.includes(fw.uniqueBuild)
      }).length > 0
    }).sort((a,b) => a.priority - b.priority)
    write(path.join(dirName, dev, fw.uniqueBuild + '.json'), JSON.stringify(jb, null, 2))
  })
})

console.log('Files Written:', filesWritten)
