/*global describe, it, expect, geo*/
describe('geo.sceneObject', function() {
  function CallCounter(extraData) {
    var m_this = this;
    this.ncalls = 0;
    this.call = function (evtData) {
      if (extraData !== null) {
        expect(evtData).toBe(extraData);
      }
      m_this.ncalls++;
    };
  }
  describe('Check tree operators', function () {
    it('addChild', function () {
      var parent = new geo.sceneObject(),
          children = [
            new geo.sceneObject(),
            new geo.sceneObject(),
            new geo.sceneObject()
          ];
      children.forEach(function (child) {
        parent.addChild(child);
      });
      
      expect(parent.parent()).toBe(null);
      parent.children().forEach(function (child, idx) {
        expect(child).toBe(children[idx]);
        expect(child.parent()).toBe(parent);
        expect(child.children().length).toBe(0);
      });
    });

    it('removeChild', function () {
      function deepCount(obj) {
        var n = 1;
        obj.children().forEach(function (child) {
          n += deepCount(child);
        });
        return n;
      }
      function spawnThree(r) {
        r.addChild(new geo.sceneObject());
        r.addChild(new geo.sceneObject());
        r.addChild(new geo.sceneObject());
      }
      var root = new geo.sceneObject(), child;
      spawnThree(root);
      expect(deepCount(root)).toBe(4);
      root.children().forEach(function (child) {
        spawnThree(child);
        child.children().forEach(spawnThree);
      });
      expect(deepCount(root)).toBe(40);

      root.removeChild(root.children()[0]);
      expect(deepCount(root)).toBe(27);
      
      child = root.children()[0];
      child.removeChild(child.children()[2]);
      expect(deepCount(root)).toBe(23);
      
      child = new geo.sceneObject();
      root.addChild(child);
      expect(deepCount(root)).toBe(24);

      root.removeChild(child);
      expect(deepCount(root)).toBe(23);

      root.children().forEach(root.removeChild);
      expect(deepCount(root)).toBe(1);
    });
  });

  describe('Check signal propagation', function () {
    function makeNode(root) {
      var child = new geo.sceneObject();
      child._handler = new CallCounter(null);
      child.count = function () {
        return child._handler.ncalls;
      };
      child.on('signal', child._handler.call);
      if (root) {
        root.addChild(child);
      }
      return child;
    }

    it('Simple tree', function () {
      var root = makeNode(),
          child = makeNode(root),
          grandchild = makeNode(child);
      function checkCounts(n) {
        expect(root.count()).toBe(n);
        expect(child.count()).toBe(n);
        expect(grandchild.count()).toBe(n);
      }
      checkCounts(0);

      root.trigger('signal');
      checkCounts(1);

      child.trigger('signal');
      checkCounts(2);

      grandchild.trigger('signal');
      checkCounts(3);
    });

    it('Shallow tree', function () {
      var root = makeNode();
      function checkCounts(n) {
        expect(root.count()).toBe(n);
        root.children().forEach(function (child) {
          expect(child.count()).toBe(n);
        });
      }
      
      var i, n;
      for (i = 0; i < 10; i++) {
        makeNode(root);
      }
      
      checkCounts(0);

      root.trigger('signal');
      checkCounts(1);
      
      n = 1;
      root.children().forEach(function (child) {
        child.trigger('signal');
        checkCounts(++n);
      });
    });

    it('Binary tree', function () {
      var root = makeNode(), nTrigger = 0;

      function checkCounts(root, n) {
        expect(root.count()).toBe(n);
        root.children().forEach(function (child) {
          checkCounts(child, n);
        });
      }

      function makeLevel(root, depth) {
        if (depth > 5) {
          return;
        }

        makeLevel(makeNode(root), depth + 1);
        makeLevel(makeNode(root), depth + 1);
      }

      function triggerEach(thisRoot) {
        thisRoot.trigger('signal');
        checkCounts(root, ++nTrigger);
        thisRoot.children().forEach(function (child) {
          triggerEach(child);
        });
      }
      
      makeLevel(root, 0);
      checkCounts(root, 0);

      triggerEach(root);
    });

    it('Stop propagation', function () {
      var root, child1, child2, child2Called = false;
      root = geo.sceneObject();
      child1 = geo.sceneObject();
      child2 = geo.sceneObject();

      root.addChild(child1);
      child1.addChild(child2);

      child2.on('signal', function () {
        child2Called = true;
      });
      root.trigger('signal');

      expect(child2Called).toBe(true);

      child1.on('signal', function (args) {
        args.geo.stopPropagation = true;
      });

      child2Called = false;
      root.trigger('signal');

      expect(child2Called).toBe(false);
    });

    it('Children only', function () {
      var root, child1, child2, child1Called = false, child2Called = false, rootCalled = false;
      root = geo.sceneObject();
      child1 = geo.sceneObject();
      child2 = geo.sceneObject();

      root.addChild(child1);
      child1.addChild(child2);

      root.on('signal', function () {
        rootCalled = true;
      });
      child1.on('signal', function () {
        child1Called = true;
      });
      child2.on('signal', function () {
        child2Called = true;
      });
      child1.trigger('signal', {}, true);

      expect(child1Called).toBe(true);
      expect(child2Called).toBe(true);
      expect(rootCalled).toBe(false);
    });
  });
});