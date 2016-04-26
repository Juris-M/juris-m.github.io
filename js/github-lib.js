var GitHub = function(access_token, jurisdictionWorker, validateContent, submitButton){
    /*
     * Exports
     */

    this.githubInit = githubInit;
    this.submitPullRequest = githubSubmitPullRequest;
    this.ghMsg = ghMsg;
    this.username = username;

    var username = null;
    
    /*
     * General functions
     */

    var debugFlag = true;

    function debugMsg(msg) {
        if (debugFlag) {
            console.log("XXX " + msg)
        }
    }

    function ghMsg(errorSpec, err) {
        if (!errorSpec) {
            return;
        }
        if (err && err.message) {
            //err = err.message;
        } else if ('string' !== typeof err) {
            err = false;
        }
        err = err ? '<div style="font-size:larger;font-weight:bold;">GitHub says</div><p>' + JSON.stringify(err) + '</p>' : '';
        $('#submit').popover({
            html: true,
            title: errorSpec.type + ' <a class="close" href="#");">&times;</a>',
            content: '<p>' + errorSpec.desc + '</p>' + err,
            trigger: 'manual',
            placement: 'bottom'
        });
        $(document).click(function (e) {
            if (($('.popover').has(e.target).length == 0) || $(e.target).is('.close')) {
                $('#submit').popover('destroy');
            }
        });
        $('#submit').popover('show');
        submitButton.stop();
        if (errorSpec.disable) {
            submitButton.disable();
            return false;
        }
        return true;
    }
    
    function ghApi(method, path, options, errorSpec, callback, raw) {
        var xhr = new XMLHttpRequest();
        if (method === 'GET') {
            var query = options ? '?' + $.param(options) : '';
            var options = null;
        } else {
            var query = '';
            var options = JSON.stringify(options);
        }
        if (path.slice(0,1) === '/') {
            var host = 'https://api.github.com';
        } else {
            var host = '';
        }
        xhr.open(method, host + path + query, true);
        xhr.setRequestHeader('Content-Type','application/json;charset=UTF-8');
        if (raw) {
            xhr.setRequestHeader('Accept','application/vnd.github.v3.raw');
        } else {
            xhr.responseType = 'json';
            xhr.setRequestHeader('Accept','application/vnd.github.v3+json');
        }
        xhr.setRequestHeader("Authorization", "token " + access_token);
        xhr.onload = function(e) {
            if (this.readyState === 4) {
                if (this.status >= 200 && this.status < 300 || this.status === 304) {
                    var obj = this.response;
                    callback(obj);
                } else {
                    if (errorSpec) {
                        ghMsg(errorSpec, this.statusText);
                    } else {
                        callback(null);
                    }
                }
            }
        }
        xhr.onerror = function (e) {
            ghMsg(errorSpec, e);
        };
        xhr.send(options);
    }

    function ghWaitForFileContents(owner, branch, fileName, callback, fallback) {
        var counter = 0;
        var _ghWaitForFileContents = function(owner, branch, fileName, callback) {
            return function () {
                var options = {
                    ref: branch
                }
                ghApi('GET', '/repos/' + owner + '/style-modules/contents/' + fileName, options, null, function(contents){
                    if (contents) {
                        callback(contents);
                    } else {
                        if (counter < 3) {
                            setTimeout(_ghWaitForFileContents, 500);
                            counter += 1;
                        } else if (fallback) {
                            callback(null);
                        }
                    }
                });
            }
        }(owner, branch, fileName, callback);
        _ghWaitForFileContents();
        
    }

    /* 
     * Intermediate functions
     */

    function ghInitGetUser(info) {
        debugMsg("ghInitGetUser()");
        var errorSpec = {
            type: 'Error',
            desc: 'Unable to get your user account details for some reason.',
            disable: true
        }
        ghApi('GET', '/user', null, errorSpec, function(user){
            info.username = user.login;
            // Expose username in the GitHub login object
            username = info.username;
            // Now try to acquire the master. This should always work, in theory at least.
            ghInitUserCopy(info);
        });
    }


    function ghInitUserCopy(info) {
        debugMsg("ghInitUserCopy()");
        ghWaitForFileContents(info.username, info.branchKey, 'juris-' + info.branchKey + '.csl', function(contents) {
            if (!contents) {
                // If we didn't get a user copy, try for master
                ghInitMasterCopy(info);
            } else {
                // If we got a user copy, run with it.
                // We assume there will not be conflicts ...
                ghGetFileContent(info.username, contents.sha, function(content){
                    validateContent(content);
                });
            }
        }, 'fallback');
    }

    function ghInitMasterCopy(info) {
        debugMsg("ghInitMasterCopy()");
        ghWaitForFileContents('juris-m', 'master', 'juris-' + info.branchKey + '.csl', function(contents) {
            if (!contents) {
                // The file does not yet exist
                jurisdictionWorker.postMessage({type:'REQUEST MODULE TEMPLATE',key:info.moduleKey,name:info.moduleName});
            } else {
                // If we got a master copy, use that
                ghGetFileContent('juris-m', contents.sha, function(content){
                    validateContent(content);
                });
                // Also expose a link to the user's GitHub branch
                $('#github-link').attr('href', 'https://github.com/' + info.username + '/style-modules');
                $('#github-link').show();
            }
        }, 'fallback');
    }
    
    function ghGetUser(info) {
        debugMsg("ghGetUser()");
        var errorSpec = {
            type: 'Error',
            desc: 'Unable to get your user account details for some reason.',
            disable: true
        }
        ghApi('GET', '/user', null, errorSpec, function(user){
            // Create or open a fork of style-modules
            info.username = user.login;
            ghOpenFork(info);
        });
    }

    function ghOpenFork(info) {
        debugMsg("ghOpenFork()");
        var errorSpec = {
            type: 'Error',
            desc: 'There seems to be a problem with making a copy of the style modules repository. It is worth trying again, as this may be a transient failure.',
            disable: true
        }
        ghApi('POST', '/repos/juris-m/style-modules/forks', {}, errorSpec, function(fork) {
            ghWaitForFileContents(info.username, 'master', 'README.md', function() {
                if (fork.parent && fork.parent.full_name === 'Juris-M/style-modules') {
                    // While we're here, be sure the GitHub view is exposed for the user
                    $('#github-link').attr('href', 'https://github.com/' + info.username + '/style-modules');
                    $('#github-link').show();
                    // Proceed with pull request chain
                    ghGetUpstreamMasterSha(info);
                } else {
                    var msgSpec = {
                        type: 'Error',
                        desc: 'You have a <span style="font-family:mono;">style-modules</span> repository on GitHub that is not forked from Juris-M. You will need to rename it to continue.',
                        disable: true
                    }
                }
            });
        });
    }
        
    function ghGetUpstreamMasterSha(info) {
        debugMsg("ghGetUpstreamMasterSha()");
        var errorSpec = {
            type: 'Error',
            desc: 'Unable to get the latest changes to the master copy for some reason.',
            disable: true
        }
        ghApi('GET', '/repos/juris-m/style-modules/git/refs/heads/master', null, errorSpec, function(ref) {
            info.upstream_sha = ref.object.sha
            ghCheckForkBranch(info);
        });
    }

    function ghCheckForkBranch(info) {
        debugMsg("ghCheckForkBranch()");
        ghApi('GET', '/repos/' + info.username + '/style-modules/git/refs/heads/' + info.branchKey, null, null, function(ref){
            if (ref && ref.object) {
		        info.fork_branch_commit_sha = ref.object.sha;
		        info.fork_branch_commit_url = ref.object.url;
                ghCheckMasterFileContent(info);
            } else {
                ghCastBranchFromMaster(info);
            }
        });
    }

    function ghCastBranchFromMaster(info) {
        debugMsg("ghCastBranchFromMaster()");
        var errorSpec = {
            type: 'Error',
            desc: 'Unable to create a working copy of the Juris-M repository for some reason.',
            disable: true
        }
        var options = {
            ref: 'refs/heads/' + info.branchKey,
            sha: info.upstream_sha
        }
        ghApi('POST', '/repos/' + info.username + '/style-modules/git/refs', options, errorSpec, function(ref){
	        info.fork_branch_commit_sha = ref.object.sha;
	        info.fork_branch_commit_url = ref.object.url;
            ghCheckMasterFileContent(info);
        });
    }

    function ghCheckMasterFileContent(info) {
        debugMsg("ghCheckMasterFileContent()");
        ghWaitForFileContents('juris-m', 'master', 'juris-' + info.branchKey + '.csl', function(contents) {
            if (!contents) {
                ghCheckForkBranchFile(info);
            } else {
                ghGetFileContent('juris-m', contents.sha, function(content){
                    if (content.trim() !== info.moduleContent) {
                        ghCheckForkBranchFile(info);
                    } else {
                        var msgSpec = {
                            type: 'No Action',
                            desc: 'This submission would not change the existing module code.',
                            disable: true
                        }
                        ghMsg(msgSpec);
                    }
                });
            }
        }, 'fallback');
    }

    function ghCheckForkBranchFile(info) {
        debugMsg("ghCheckForkBranchFile()");
        var options = {
            ref: info.branchKey
        }
        ghWaitForFileContents(info.username, info.branchKey, 'juris-' + info.branchKey + '.csl', function(contents) {
            if (!contents) {
                ghGetForkBranchCommit(info);
            } else {
                ghGetFileContent(info.username, contents.sha, function(content){
                    if (content.trim() !== info.moduleContent) {
                        ghGetForkBranchCommit(info);
                    } else {
                        var msgSpec = {
                            type: 'No Action',
                            desc: 'No changes made to the existing file.',
                            disable: true
                        }
                        ghMsg(msgSpec);
                    }
                });
            }
	    }, 'fallback');
    }
    
    function ghGetForkBranchCommit(info) {
        debugMsg("ghGetForkBranchCommit()");
        ghApi('GET', info.fork_branch_commit_url, null, null, function(commit){
            info.fork_branch_tree_sha = commit.tree.sha;
            info.fork_branch_tree_url = commit.tree.url;
	        ghWriteBlob(info);
        });
    }

    function ghWriteBlob(info) {
        debugMsg("ghWriteBlob()");
        var errorSpec = {
            type: 'Error',
            desc: 'Unable to create the style module file in your GitHub account for some reason.',
            disable: true
        }
        // Write as a BLOB instead, with encoding=utf-8
        var options = {
            content: info.moduleContent,
            encoding: 'utf-8'
        }
        ghApi('POST', '/repos/' + info.username + '/style-modules/git/blobs', options, errorSpec, function(data){
		    info.fork_blob_sha = data.sha;
		    ghCastTreeWithFile(info);
        });
    }

    function ghCastTreeWithFile(info) {
        debugMsg("ghCastTreeWithFile()");
        var errorSpec = {
            type: "Error",
            desc: "Unable to create tree for the new file"
        }
        var options = {
            "base_tree": info.fork_branch_tree_sha,
            "tree": [
                {
	                "path": 'juris-' + info.branchKey + '.csl',
	                "mode": "100644",
	                "type": "blob",
	                "sha": info.fork_blob_sha
                }
            ]
        }
        ghApi('POST', '/repos/' + info.username + '/style-modules/git/trees', options, errorSpec, function(data){
            info.new_tree_sha = data.sha;
	        ghCastFileCommit(info);
        });
    }

    function ghCastFileCommit(info) {
        debugMsg("ghCastFileCommit()");
        var errorSpec = {
            type: "Error",
            desc: "Unable to create commit for the new file"
        }
        var options = {
            message: "Juris-M module update: juris-" + info.branchKey + ".csl",
            tree: info.new_tree_sha,
            parents: [info.fork_branch_commit_sha]
        }
        ghApi('POST', '/repos/' + info.username + '/style-modules/git/commits', options, errorSpec, function(commit){
	        info.commit_sha = commit.sha;
            ghUpdateForkBranchHead(info);
        });
    }

    function ghUpdateForkBranchHead(info) {
	    debugMsg("ghUpdateForkBranchHead()");
        var errorSpec = {
            type: "Error",
            desc: "Unable to mark new edit as the latest for some reason."
        }
        var options = {
            sha: info.commit_sha,
            force: true
        }
        ghApi('PATCH', '/repos/' + info.username + '/style-modules/git/refs/heads/' + info.branchKey, options, errorSpec, function(data){
            ghCheckForPullRequest(info);
        });
    }

    function ghCheckForPullRequest(info) {
        debugMsg("ghCheckForPullRequest()");
        var options = {
            state: 'open',
            head: info.username + ':' + info.branchKey,
            base: 'master'
        }
        ghApi('GET', '/repos/juris-m/style-modules/pulls', options, null, function(pulls){
            if (pulls && pulls.length) {
                msgSpec = {
                    type: 'Success',
                    desc: 'Your latest changes have been added to the edit request. Thank you for your submissions!',
                    disable: true
                }
                ghMsg(msgSpec);
            } else {
                ghWaitForFileContents(info.username, info.branchKey, 'juris-' + info.branchKey + '.csl', function(contents){
                    ghCreatePullRequest(info);
                });
            }
        });
    }

    function ghCreatePullRequest(info) {
        debugMsg("ghCreatePullRequest()");
        var errorSpec = {
            type: 'Error',
            desc: 'Your edit request did not go through for some reason.'
        }
        var pull = {
            title: "Update to style module: juris-" + info.branchKey + '.csl',
            body: 'Pull request automatically generated by Juris-M',
            base: "master",
            head: info.username + ":" + info.branchKey
        };
        ghApi('POST', '/repos/Juris-M/style-modules/pulls', pull, errorSpec, function(pullRequest) {
            msgSpec = {
                type: 'Success',
                desc: 'Thank you for your submission!',
                disable: true
            }
            ghMsg(msgSpec);
        });
    }

    function ghGetFileContent(owner, sha, callback) {
        debugMsg("ghGetFileContent()");
        var errorSpec = {
            type: 'Error',
            desc: 'Failed to read a file from GitHub for some reason.',
            disable: true
        }
        ghApi('GET', '/repos/' + owner + '/style-modules/git/blobs/' + sha, null, errorSpec, callback, 'raw');
    }
   
    /*
     * Top-level functions
     */

    function githubInit(moduleKey, moduleName) {
        debugMsg("githubInit() **********");
        var info = {
            moduleName: moduleName,
            moduleKey: moduleKey,
            branchKey: moduleKey.replace(/\:/g, '+')
        }
        ghInitGetUser(info);
    }

    function githubSubmitPullRequest(moduleKey, moduleContent) {
        debugMsg("githubSubmitPullRequest() *****");
        var info = {
            moduleContent: moduleContent,
            moduleKey: moduleKey,
            branchKey: moduleKey.replace(/\:/g,'+')
        }
        // Get the user and proceed.
        ghGetUser(info);
    }
};
