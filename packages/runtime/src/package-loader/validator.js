export class PackageValidator {
  constructor(options = {}) {
    this._options = {
      security: null,
      maxPackageSize: 100 * 1024 * 1024,
      maxAssetSize: 20 * 1024 * 1024,
      allowedTypes: ['lesson', 'quiz', 'game', 'simulation', 'lab', 'assessment', 'activity'],
      maxSlides: 500,
      maxQuizzes: 200,
      maxAssets: 500,
      ...options
    };
  }

  async validate(pkg) {
    if (!pkg) {
      throw new Error('Package is null or undefined');
    }
    if (!pkg.manifest) {
      throw new Error('Package manifest is missing');
    }
    this._validateManifest(pkg.manifest);
    this._validateSlides(pkg.manifest.slides);
    this._validateQuizzes(pkg.manifest.quizzes);
    this._validateAssets(pkg.manifest.assets, pkg.resources);
    this._validateDependencies(pkg.manifest.dependencies);

    if (this._options.security) {
      this._options.security.validatePackage(pkg);
    }

    return true;
  }

  _validateManifest(manifest) {
    if (!manifest.id || typeof manifest.id !== 'string') {
      throw new Error('Manifest must have a valid "id" field');
    }
    if (manifest.id.length > 128) {
      throw new Error('Package ID exceeds maximum length of 128 characters');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(manifest.id)) {
      throw new Error(`Package ID "${manifest.id}" contains invalid characters`);
    }
    if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error(`Invalid version: "${manifest.version}". Must be semver (e.g. 1.0.0)`);
    }
    if (!manifest.title || typeof manifest.title !== 'string') {
      throw new Error('Manifest must have a valid "title" field');
    }
    if (manifest.title.length > 200) {
      throw new Error('Title exceeds maximum length of 200 characters');
    }
    if (manifest.type && !this._options.allowedTypes.includes(manifest.type)) {
      throw new Error(`Invalid package type: "${manifest.type}". Allowed: ${this._options.allowedTypes.join(', ')}`);
    }
    if (manifest.permissions && Array.isArray(manifest.permissions)) {
      const validPermissions = ['storage', 'media', 'quiz', 'game', 'analytics', 'timer', 'canvas', 'audio', 'video'];
      for (const perm of manifest.permissions) {
        if (!validPermissions.includes(perm)) {
          throw new Error(`Invalid permission requested: "${perm}"`);
        }
      }
    }
    if (manifest.runtimeVersion) {
      const versionPattern = /^[><=!~^]{1,2}\d+\.\d+\.\d+$|^\d+\.\d+\.\d+$/;
      if (!versionPattern.test(manifest.runtimeVersion.replace(/\s/g, ''))) {
        throw new Error(`Invalid runtimeVersion format: "${manifest.runtimeVersion}"`);
      }
    }
  }

  _validateSlides(slides) {
    if (!slides) return;
    if (!Array.isArray(slides)) {
      throw new Error('Slides must be an array');
    }
    if (slides.length > this._options.maxSlides) {
      throw new Error(`Too many slides: ${slides.length}. Maximum: ${this._options.maxSlides}`);
    }
    const ids = new Set();
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (!slide.id && !slide.content) {
        throw new Error(`Slide at index ${i} must have an "id" or "content" field`);
      }
      if (slide.id) {
        if (ids.has(slide.id)) {
          throw new Error(`Duplicate slide ID: "${slide.id}"`);
        }
        ids.add(slide.id);
      }
    }
  }

  _validateQuizzes(quizzes) {
    if (!quizzes) return;
    if (!Array.isArray(quizzes)) {
      throw new Error('Quizzes must be an array');
    }
    if (quizzes.length > this._options.maxQuizzes) {
      throw new Error(`Too many quizzes: ${quizzes.length}. Maximum: ${this._options.maxQuizzes}`);
    }
    for (let i = 0; i < quizzes.length; i++) {
      const quiz = quizzes[i];
      if (quiz.questions && Array.isArray(quiz.questions)) {
        for (let j = 0; j < quiz.questions.length; j++) {
          const q = quiz.questions[j];
          if (q.type === 'multiple-choice' && (!q.options || q.options.length < 2)) {
            throw new Error(`Quiz "${quiz.id || i}" question ${j}: multiple-choice requires at least 2 options`);
          }
        }
      }
    }
  }

  _validateAssets(assets, resources) {
    if (!assets) return;
    if (!Array.isArray(assets)) {
      throw new Error('Assets must be an array');
    }
    if (assets.length > this._options.maxAssets) {
      throw new Error(`Too many assets: ${assets.length}. Maximum: ${this._options.maxAssets}`);
    }
    const validTypes = ['html', 'css', 'js', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp3', 'mp4', 'webm', 'ogg', 'woff', 'woff2', 'ttf', 'ico'];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      if (asset.type && !validTypes.includes(asset.type)) {
        throw new Error(`Asset at index ${i} has invalid type: "${asset.type}"`);
      }
    }
  }

  _validateDependencies(dependencies) {
    if (!dependencies) return;
    if (!Array.isArray(dependencies)) {
      throw new Error('Dependencies must be an array');
    }
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      if (!dep.id) {
        throw new Error(`Dependency at index ${i} must have an "id" field`);
      }
      if (!dep.version) {
        throw new Error(`Dependency "${dep.id}" must have a "version" field`);
      }
    }
  }
}
