//////////////////////////////////////////////////////////////////////////////
/**
 * Create a new instance of class vglRenderer
 *
 * @class
 * @extends geo.renderer
 * @param canvas
 * @returns {geo.gl.vglRenderer}
 */
//////////////////////////////////////////////////////////////////////////////
geo.gl.vglRenderer = function (arg) {
  'use strict';

  if (!(this instanceof geo.gl.vglRenderer)) {
    return new geo.gl.vglRenderer(arg);
  }
  arg = arg || {};
  geo.renderer.call(this, arg);

  var m_this = this,
      m_contextRenderer = null,
      m_viewer = null,
      m_width = 0,
      m_height = 0,
      m_renderAnimFrameRef = null,
      s_init = this._init,
      s_exit = this._exit;

  /// TODO: Move this API to the base class
  ////////////////////////////////////////////////////////////////////////////
  /**
   * Return width of the renderer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.width = function () {
    return m_width;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Return height of the renderer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.height = function () {
    return m_height;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Get context specific renderer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.contextRenderer = function () {
    return m_contextRenderer;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Get API used by the renderer
   */
  ////////////////////////////////////////////////////////////////////////////
  this.api = function () {
    return 'vgl';
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Initialize
   */
  ////////////////////////////////////////////////////////////////////////////
  this._init = function () {
    if (m_this.initialized()) {
      return m_this;
    }

    s_init.call(m_this);

    var canvas = $(document.createElement('canvas'));
    canvas.attr('class', 'webgl-canvas');
    $(m_this.layer().node().get(0)).append(canvas);
    m_viewer = vgl.viewer(canvas.get(0), arg.options);
    m_viewer.init();
    m_contextRenderer = m_viewer.renderWindow().activeRenderer();
    m_contextRenderer.setResetScene(false);

    if (m_viewer.renderWindow().renderers().length > 0) {
      m_contextRenderer.setLayer(m_viewer.renderWindow().renderers().length);
    }
    m_this.canvas(canvas);
    /* Initialize the size of the renderer */
    var map = m_this.layer().map(),
        mapSize = map.size();
    m_this._resize(0, 0, mapSize.width, mapSize.height);

    return m_this;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Handle resize event
   */
  ////////////////////////////////////////////////////////////////////////////
  this._resize = function (x, y, w, h) {
    var renderWindow = m_viewer.renderWindow();

    m_width = w;
    m_height = h;
    m_this.canvas().attr('width', w);
    m_this.canvas().attr('height', h);
    renderWindow.positionAndResize(x, y, w, h);

    m_this._updateRendererCamera();
    m_this._render();

    return m_this;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Render
   */
  ////////////////////////////////////////////////////////////////////////////
  this._render = function () {
    if (m_renderAnimFrameRef === null) {
      m_renderAnimFrameRef = window.requestAnimationFrame(function () {
        m_renderAnimFrameRef = null;
        m_viewer.render();
      });
    }
    return m_this;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Exit
   */
  ////////////////////////////////////////////////////////////////////////////
  this._exit = function () {
    m_viewer.exit();
    s_exit();
  };

  this._updateRendererCamera = function () {
    var renderWindow = m_viewer.renderWindow(),
        map = m_this.layer().map(),
        camera = map.camera(),
        rotation = map.rotation() || 0,
        view = camera.view,
        proj = camera.projectionMatrix;
    if (proj[15]) {
      /* we want positive z to be closer to the camera, but webGL does the
       * converse, so reverse the z coordinates. */
      proj = mat4.scale(geo.util.mat4AsArray(), proj, [1, 1, -1]);
    }
    /* A similar kluge as in the base camera class worldToDisplay4.  With this,
     * we can show z values from 0 to 1. */
    proj = mat4.translate(geo.util.mat4AsArray(), proj,
                          [0, 0, camera.constructor.bounds.far]);
    /* Check if the rotation is a multiple of 90 */
    var basis = Math.PI / 2,
        angle = rotation % basis,  // move to range (-pi/2, pi/2)
        ortho = (Math.min(Math.abs(angle), Math.abs(angle - basis)) < 0.00001);
    renderWindow.renderers().forEach(function (renderer) {
      var cam = renderer.camera();
      if (geo.util.compareArrays(view, cam.viewMatrix()) &&
          geo.util.compareArrays(proj, cam.projectionMatrix())) {
        return;
      }
      cam.setViewMatrix(view, true);
      cam.setProjectionMatrix(proj);
      if (proj[1] || proj[2] || proj[3] || proj[4] || proj[6] || proj[7] ||
          proj[8] || proj[9] || proj[11] || proj[15] !== 1 || !ortho ||
          (parseFloat(map.zoom().toFixed(6)) !==
           parseFloat(map.zoom().toFixed(0)))) {
        /* Don't align texels */
        cam.viewAlignment = function () {
          return null;
        };
      } else {
        /* Set information for texel alignment.  The rounding factors should
         * probably be divided by window.devicePixelRatio. */
        cam.viewAlignment = function () {
          var align = {
            roundx: 2.0 / camera.viewport.width,
            roundy: 2.0 / camera.viewport.height
          };
          align.dx = (camera.viewport.width % 2) ? align.roundx * 0.5 : 0;
          align.dy = (camera.viewport.height % 2) ? align.roundy * 0.5 : 0;
          return align;
        };
      }
    });
  };

  // Connect to interactor events
  // Connect to pan event
  m_this.layer().geoOn(geo.event.pan, function (evt) {
    void(evt);
    m_this._updateRendererCamera();
  });

  // Connect to zoom event
  m_this.layer().geoOn(geo.event.zoom, function (evt) {
    void(evt);
    m_this._updateRendererCamera();
  });

  // Connect to rotation event
  m_this.layer().geoOn(geo.event.rotate, function (evt) {
    void(evt);
    m_this._updateRendererCamera();
  });

  // Connect to parallelprojection event
  m_this.layer().geoOn(geo.event.parallelprojection, function (evt) {
    var vglRenderer = m_this.contextRenderer(),
        camera,
        layer = m_this.layer();

    if (evt.geo && evt.geo._triggeredBy !== layer) {
      if (!vglRenderer || !vglRenderer.camera()) {
        console.log('Parallel projection event triggered on unconnected VGL ' +
                    'renderer.');
      }
      camera = vglRenderer.camera();
      camera.setEnableParallelProjection(evt.parallelProjection);
      m_this._updateRendererCamera();
    }
  });

  return this;
};

inherit(geo.gl.vglRenderer, geo.renderer);

geo.registerRenderer('vgl', geo.gl.vglRenderer);

(function () {
  'use strict';

  var checkedWebGL;

  /**
   * Report if the vgl renderer is supported.  This is just a check if webGL is
   * supported and available.
   *
   * @returns {boolean} true if available.
   */
  geo.gl.vglRenderer.supported = function () {
    if (checkedWebGL === undefined) {
      /* This is extracted from what Modernizr uses. */
      var canvas, ctx, exts;
      try {
        canvas = document.createElement('canvas');
        ctx = (canvas.getContext('webgl') ||
               canvas.getContext('experimental-webgl'));
        exts = ctx.getSupportedExtensions();
        checkedWebGL = true;
      } catch (e) {
        console.error('No webGL support');
        checkedWebGL = false;
      }
      canvas = undefined;
      ctx = undefined;
      exts = undefined;
    }
    return checkedWebGL;
  };

  /**
   * If the vgl renderer is not supported, supply the name of a renderer that
   * should be used instead.  This asks for the null renderer.
   *
   * @returns null for the null renderer.
   */
  geo.gl.vglRenderer.fallback = function () {
    return null;
  };
})();
