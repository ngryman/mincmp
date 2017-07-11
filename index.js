const Jimp = require('jimp')
const Pageres = require('pageres')
const slugify = require('filenamify-url')
const sizeOf = require('image-size')
const got = require('got')
const meow = require('meow')
const fs = require('fs')

const WIDTH = 1680
const PADDING = 100
const ZOOM = 0.2

const cli = meow(`
  Usage
    $ mincmp package/filepath
`)

async function screenshot(files) {
  const pageres = new Pageres({
    filename: '<%= url %>'
  })
  
  const urls = files.map(file => `http://unpkg.com/${file}`)
  for (let url of urls) {
    pageres.src(url, ['1680x1200'])
  }
  
  pageres.dest(__dirname)
  await pageres.run()
  
  return urls.map(url => {
    console.log(`⬇  ${url}`)
    const file = `${slugify(url)}.png`
    return ({
      file,
      size: sizeOf(file)
    })
  })
}

async function compose(screencaps) {
  const canvasWidth = (
    screencaps.length * (WIDTH + PADDING) + PADDING
  ) * ZOOM | 0
  
  const canvasHeight = (
    screencaps.reduce((max, { size }) => (
      size.height > max ? size.height : max
    ), 0) + 2 * PADDING
  ) * ZOOM | 0
  
  const zoomedPadding = PADDING * ZOOM
  const canvas = new Jimp(canvasWidth, canvasHeight, 0xffffffff)
  
  for (let i = 0; i < screencaps.length; i++) {
    const screencap = screencaps[i]
    
    const image = await Jimp.read(screencap.file)
    image.autocrop()
    image.scale(ZOOM)
    
    const x = zoomedPadding + (image.bitmap.width + zoomedPadding) * i
    const y = canvasHeight - zoomedPadding - image.bitmap.height
    canvas.blit(image, x, y)
  }
  
  canvas.write(__dirname + '/result.png')
  return screencaps
}

async function cleanup(screencaps) {
  await Promise.all(screencaps.map(screencap => (
    new Promise(resolve => fs.unlink(screencap.file, resolve))
  )))
}

screenshot(cli.input)
  .then(compose)
  .then(cleanup)
  .then(() => console.log('🎨  Done'))