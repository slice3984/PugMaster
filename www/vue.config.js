const path = require("path");

const config = require('../config.json');
const port = config.webserver.port;

module.exports = {
  publicPath: '/pickup',
  outputDir: path.resolve(__dirname, "../dist/www/"),
  lintOnSave: false,
  devServer: {
    proxy: `http://localhost:${port}`
  },
  css: {
    loaderOptions: {
      sass: {
        prependData: `
          @import "@/scss/_variables.scss";
          `
      }
    }
  }
}