function blur(x, y, src, dest, program) {
    dest.Bind();
    dest.SetViewport();

    program.Use();
    program.SendTexture2D("tex", src.texture, 0);
    program.Send2f("resolution", dest.width, dest.height);
    program.Send2f("gaussianDir", x, y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dest.UnBind();
}

function reflectionBlur(x, y, src, dest, program, gBufferTextures) {
    dest.Bind();
    dest.SetViewport();

    program.Use();
    program.SendTexture2D("tex", src, 0);
    program.Send2f("resolution", dest.width, dest.height);
    program.Send2f("blurDir", x, y);
    program.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 1);
    program.SendTexture2D("roughnessTexture", gBufferTextures.texture1, 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dest.UnBind();
}

window.onload = function () {
    // Create canvas
    const canvas = document.createElement("canvas");
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = window.innerWidth+"px";
    canvas.style.height = window.innerHeight+"px";
    document.body.appendChild(canvas);

    // Setup WebGL2 and Extensions
    gl = canvas.getContext("webgl2") || canvas.getContext("experimental-webgl2");
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension('OES_texture_float_linear');

    // Shader Setup
    const vertex ="#version 300 es\nvoid main(){gl_Position=vec4(ivec2(gl_VertexID&1,gl_VertexID>>1)*2-1,0,1);}" // Thanks gaz
    const vertexShader = new Shader(vertex, gl.VERTEX_SHADER);
    const lightingShader = new Shader(mainHeader.text + shade.text, gl.FRAGMENT_SHADER);
    const combineBloomAndFiltersShader = new Shader(combineBloomAndFilters.text, gl.FRAGMENT_SHADER);
    const gaussianShader = new Shader(gaussian.text, gl.FRAGMENT_SHADER);
    const sumBloomShader = new Shader(sumBloom.text, gl.FRAGMENT_SHADER);
    const gBufferShader = new Shader(mainHeader.text + GBuffer.text, gl.FRAGMENT_SHADER);
    const blurShader = new Shader(blurReflection.text, gl.FRAGMENT_SHADER);
    const DOFShader = new Shader(DOF.text, gl.FRAGMENT_SHADER);
    const nearShader = new Shader(extractNear.text, gl.FRAGMENT_SHADER);
    const farShader = new Shader(extractFar.text, gl.FRAGMENT_SHADER);
    const combineDOFShader = new Shader(DOFCombine.text, gl.FRAGMENT_SHADER);
    const postProcessShader = new Shader(postProcess.text, gl.FRAGMENT_SHADER);

    const lightingProgram = new ShaderProgram();
    const combineBloomAndFiltersProgram = new ShaderProgram();
    const gaussianProgram = new ShaderProgram();
    const sumBloomProgram = new ShaderProgram();
    const gBufferProgram = new ShaderProgram();
    const blurProgram = new ShaderProgram();
    const DOFProgram = new ShaderProgram();
    const nearProgram = new ShaderProgram();
    const farProgram = new ShaderProgram();
    const combineDOFProgram = new ShaderProgram();
    const postProcessProgram = new ShaderProgram();

    lightingProgram.Link(vertexShader, lightingShader);
    combineBloomAndFiltersProgram.Link(vertexShader, combineBloomAndFiltersShader);
    gaussianProgram.Link(vertexShader, gaussianShader);
    sumBloomProgram.Link(vertexShader, sumBloomShader);
    gBufferProgram.Link(vertexShader, gBufferShader);
    blurProgram.Link(vertexShader, blurShader);
    DOFProgram.Link(vertexShader, DOFShader);
    nearProgram.Link(vertexShader, nearShader);
    farProgram.Link(vertexShader, farShader);
    combineDOFProgram.Link(vertexShader, combineDOFShader);
    postProcessProgram.Link(vertexShader, postProcessShader);

    // RenderTexture Setup
    const shadedTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const blurReflectionTextureX = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const blurReflectionTextureY = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const bloomTextureX1 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const bloomTextureY1 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const bloomTextureX2 = new RenderTexture(canvas.width/4, canvas.height/4, gl.FLOAT);
    const bloomTextureY2 = new RenderTexture(canvas.width/4, canvas.height/4, gl.FLOAT);
    const bloomTextureX3 = new RenderTexture(canvas.width/8, canvas.height/8, gl.FLOAT);
    const bloomTextureY3 = new RenderTexture(canvas.width/8, canvas.height/8, gl.FLOAT);
    const bloomTextureX4 = new RenderTexture(canvas.width/16, canvas.height/16, gl.FLOAT);
    const bloomTextureY4 = new RenderTexture(canvas.width/16, canvas.height/16, gl.FLOAT);
    const bloomTextureX5 = new RenderTexture(canvas.width/32, canvas.height/32, gl.FLOAT);
    const bloomTextureY5 = new RenderTexture(canvas.width/32, canvas.height/32, gl.FLOAT);
    const nearTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const farTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const DOFFarTexture = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const DOFNearTexture = new RenderTexture(canvas.width/3, canvas.height/3, gl.FLOAT);
    const DOFCombineTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const toneMappedTexture = new RenderTexture(canvas.width, canvas.height, gl.UNSIGNED_BYTE);
    const gBufferTextures = new MRTTexture4(canvas.width, canvas.height, gl.FLOAT);

    gBufferTextures.texture0.SetFilter(gl.NEAREST, gl.NEAREST);
    gBufferTextures.texture1.SetFilter(gl.NEAREST, gl.NEAREST);
    gBufferTextures.texture2.SetFilter(gl.NEAREST, gl.NEAREST);
    shadedTexture.texture.SetFilter(gl.NEAREST, gl.NEAREST);

    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    const zero = Date.now();
    (function () {
        requestAnimationFrame(arguments.callee);

        const time = (Date.now() - zero) * 0.001 - 1.0;
        const bpm69 = (time * 69.0) / 60.0;
        
        // GBuffer
        gBufferTextures.Bind();
        gBufferTextures.SetViewport();
        gBufferProgram.Use();
        gBufferProgram.Send2f("iResolution", gBufferTextures.width, gBufferTextures.height);
        gBufferProgram.Send1f("iTime", bpm69);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gBufferTextures.UnBind();

        // Blur reflections
        reflectionBlur(0.5, 0, gBufferTextures.texture3, blurReflectionTextureX, blurProgram, gBufferTextures);
        reflectionBlur(0, 1, blurReflectionTextureX.texture, blurReflectionTextureY, blurProgram, gBufferTextures);

        // Lighting
        shadedTexture.Bind();
        shadedTexture.SetViewport();
        lightingProgram.Use();
        lightingProgram.Send2f("iResolution", shadedTexture.width, shadedTexture.height);
        lightingProgram.Send1f("iTime", bpm69);
        lightingProgram.SendTexture2D("reflectTexture", blurReflectionTextureY.texture, 0);
        lightingProgram.SendTexture2D("roughnessTexture", gBufferTextures.texture1, 1);
        lightingProgram.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 2);
        lightingProgram.SendTexture2D("baseColorTexture", gBufferTextures.texture2, 3);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        shadedTexture.UnBind();

        // Extract far
        farTexture.Bind();
        farTexture.SetViewport();
        farProgram.Use();
        farProgram.Send2f("resolution", farTexture.width, farTexture.height);
        farProgram.SendTexture2D("tex", shadedTexture.texture, 0);
        farProgram.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        farTexture.UnBind();

        // Extract near
        nearTexture.Bind();
        nearTexture.SetViewport();
        nearProgram.Use();
        nearProgram.Send2f("resolution", nearTexture.width, nearTexture.height);
        nearProgram.SendTexture2D("tex", shadedTexture.texture, 0);
        nearProgram.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        nearTexture.UnBind();

        // DOF blur far
        DOFFarTexture.Bind();
        DOFFarTexture.SetViewport();
        DOFProgram.Use();
        DOFProgram.Send2f("resolution", DOFFarTexture.width, DOFFarTexture.height);
        DOFProgram.SendTexture2D("tex", farTexture.texture, 0);
        DOFProgram.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        DOFFarTexture.UnBind();

        // DOF blur far
        DOFNearTexture.Bind();
        DOFNearTexture.SetViewport();
        DOFProgram.Use();
        DOFProgram.Send2f("resolution", DOFNearTexture.width, DOFNearTexture.height);
        DOFProgram.SendTexture2D("tex", nearTexture.texture, 0);
        DOFProgram.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        DOFNearTexture.UnBind();

        // Combine far and near to shadedTexture
        DOFCombineTexture.Bind();
        DOFCombineTexture.SetViewport();
        combineDOFProgram.Use();
        combineDOFProgram.Send2f("resolution", DOFCombineTexture.width, DOFCombineTexture.height);
        combineDOFProgram.SendTexture2D("tex", shadedTexture.texture, 0);
        combineDOFProgram.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 1);
        combineDOFProgram.SendTexture2D("DOFFarTexture", DOFFarTexture.texture, 2);
        combineDOFProgram.SendTexture2D("DOFNearTexture", DOFNearTexture.texture, 3);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        DOFCombineTexture.UnBind();

        // Blur DOFCombineTexture for bloom
        blur(1, 0, DOFCombineTexture, bloomTextureX1, gaussianProgram);
        blur(0, 1, bloomTextureX1, bloomTextureY1, gaussianProgram);
        blur(2, 0, bloomTextureY1, bloomTextureX2, gaussianProgram);
        blur(0, 2, bloomTextureX2, bloomTextureY2, gaussianProgram);
        blur(2, 0, bloomTextureY2, bloomTextureX3, gaussianProgram);
        blur(0, 2, bloomTextureX3, bloomTextureY3, gaussianProgram);
        blur(4, 0, bloomTextureY3, bloomTextureX4, gaussianProgram);
        blur(0, 4, bloomTextureX4, bloomTextureY4, gaussianProgram);
        blur(4, 0, bloomTextureY4, bloomTextureX5, gaussianProgram);
        blur(0, 4, bloomTextureX5, bloomTextureY5, gaussianProgram);

        // Create bloom texture
        sumBloomProgram.Use();
        bloomTextureX1.Bind();
        bloomTextureX1.SetViewport();
        sumBloomProgram.Send2f("resolution", bloomTextureX1.width, bloomTextureX1.height);
        sumBloomProgram.SendTexture2D("tex1", bloomTextureY1.texture, 0);
        sumBloomProgram.SendTexture2D("tex2", bloomTextureY2.texture, 1);
        sumBloomProgram.SendTexture2D("tex3", bloomTextureY3.texture, 2);
        sumBloomProgram.SendTexture2D("tex4", bloomTextureY4.texture, 3);
        sumBloomProgram.SendTexture2D("tex5", bloomTextureY5.texture, 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        bloomTextureX1.UnBind();

        // Add Bloom texture to render texture
        toneMappedTexture.Bind();
        toneMappedTexture.SetViewport();
        combineBloomAndFiltersProgram.Use();
        combineBloomAndFiltersProgram.Send2f("resolution", toneMappedTexture.width, toneMappedTexture.height);
        combineBloomAndFiltersProgram.SendTexture2D("tex", DOFCombineTexture.texture, 0);
        combineBloomAndFiltersProgram.SendTexture2D("bloomTex", bloomTextureX1.texture, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        toneMappedTexture.UnBind();

        // Other postprocess
        postProcessProgram.Use();
        postProcessProgram.Send2f("resolution", canvas.width, canvas.height);
        postProcessProgram.Send1f("time", bpm69);
        postProcessProgram.SendTexture2D("tex", toneMappedTexture.texture, 0);
        gl.viewport(0.0, 0.0, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.flush();
    })();
};