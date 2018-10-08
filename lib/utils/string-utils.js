
const utils = {
  toDash: function (str) {
    return str.replace(/([A-Z])/g, function (m, w) {
      return '-' + w.toLowerCase()
    }).replace('-', '')
  },
  repeat: function (str, count) {
    if (str) {
      let rpt = ''
      for (let i = 0; i < count; i++) {
        rpt += str
      }
      return rpt
    }
  }
}
module.exports = utils