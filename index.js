const Canvas = require('canvas')
const Pageres = require('pageres')
const slugify = require('filenamify-url')
const got = require('got')
const meow = require('meow')
const fs = require('fs')

const WIDTH = 1680
const PADDING = 100
const ZOOM = 0.2

function loadImage(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, (err, data) => {
      if (err) return reject(err)
      const image = new Canvas.Image()
      image.src = data
      resolve(image)
    })
  })
}

const cli = meow(`
  Usage
    $ mincmp package/filepath
`)

async function screenshot(files) {
  const pageres = new Pageres({
    filename: '<%= url %>',
    selector: 'pre'
  })

  const urls = files.map(file => `http://unpkg.com/${file}`)
  for (let url of urls) {
    pageres.src(url, ['1680x1200'])
  }

  pageres.dest(__dirname)
  await pageres.run()

  return urls.map(url => {
    console.log(`⬇  ${url}`)
    return {
      file: `${slugify(url)}.png`
    }
  })
}

async function load(screencaps) {
  return await Promise.all(screencaps.map(screencap => (
    loadImage(screencap.file).then(image => {
      screencap.image = image
      return screencap
    })
  )))
}

async function compose(screencaps) {
  const canvasWidth = (
    screencaps.length * (WIDTH + PADDING) + PADDING
  ) * ZOOM | 0

  const canvasHeight = (
    screencaps.reduce((max, { image }) => (
      image.height > max ? image.height : max
    ), 0) + 2 * PADDING
  ) * ZOOM | 0

  const zoomedPadding = PADDING * ZOOM
  const canvas = new Canvas(canvasWidth, canvasHeight)
  const context = canvas.getContext('2d')

  context.fillStyle = 'white'
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  for (let i = 0; i < screencaps.length; i++) {
    const { image } = screencaps[i]

    const width = image.width * ZOOM
    const height = image.height * ZOOM
    const x = zoomedPadding + (width + zoomedPadding) * i
    const y = canvasHeight - zoomedPadding - height

    context.drawImage(image, x, y, width, height)
  }

  const out = fs.createWriteStream(__dirname + '/result.png')
  canvas.pngStream().pipe(out)

  return screencaps
}

async function cleanup(screencaps) {
  await Promise.all(screencaps.map(screencap => (
    new Promise(resolve => fs.unlink(screencap.file, resolve))
  )))
}

Promise.all(cli.input)
  .then(screenshot)
  .then(load)
  .then(compose)
  .then(cleanup)
  .then(() => console.log('🎨  Done'))
