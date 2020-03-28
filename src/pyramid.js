module.exports = function Pyramid() {
  this.arr = [];

  var parent = function(index) {
    return (index - 1) / 2;
  }

  var leftChild = function(index) {
    return 2 * index + 1;
  }

  var rightChild = function(index) {
    return 2 * index + 2;
  }

  this.isEmpty = function() {
    return this.arr.length;
  }

  this.up = (index) => {
    while (index !== 0 && this.arr[index] > this.arr[parent(index)]) {
      const curInd = parent(index);
      [this.arr[index], this.arr[curInd]] = [this.arr[curInd], this.arr[index]];
      index = parent(index);
    }
  }

  this.down = (index) => {
    const size = this.arr.length;
    while (index < size / 2) {
      let maxI = leftChild(index);
      if (rightChild(index) < size && this.arr[rightChild(index)] > this.arr[leftChild(index)])
          maxI = rightChild(index);
      if (this.arr[index] >= this.arr[maxI])
          return;
      [this.arr[index], this.arr[maxI]] = [this.arr[maxI], this.arr[index]];
      index = maxI;
    }
  }
}