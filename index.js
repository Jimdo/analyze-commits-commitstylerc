'use strict';

const conventionalCommitsParser = require('conventional-commits-parser');
const getChangelogrcConfig = require('get-changelogrc-config');
const RELEASE_TYPES = [
  'prerelease',
  'prepatch',
  'patch',
  'preminor',
  'minor',
  'premajor',
  'major',
];

function isMaxType(type) {
  return type === RELEASE_TYPES[RELEASE_TYPES.length - 1];
}

function validateReleaseType(type) {
  if (RELEASE_TYPES.indexOf(type) === -1) {
    throw new Error(`invalid release type "${type}"`);
  }

  return true;
}

function getHigherType(typeA, typeB) {
  const indexA = RELEASE_TYPES.indexOf(typeA);
  const indexB = RELEASE_TYPES.indexOf(typeB);

  return indexA >= indexB ? typeA : typeB;
}

function noteConfigAppliesToNote(note, noteConfig) {
  return note.title === noteConfig.keyword ||
    (noteConfig.alias && noteConfig.alias.indexOf(note.title) !== -1);
}

function getReleaseTypeFromNote(note, config) {
  return config.notes
    .filter((noteConfig) => noteConfig.release && validateReleaseType(noteConfig.release))
    .reduce((type, noteConfig) => {
      if (noteConfigAppliesToNote(note, noteConfig)) {
        return getHigherType(type, noteConfig.release);
      }

      return type;
    }, null);
}

function getReleaseTypeFromCommitType(commitType, config) {
  const commitTypeConfig = config.types.find((conf) => conf.key === commitType);

  if (commitTypeConfig && commitTypeConfig.release) {
    validateReleaseType(commitTypeConfig.release);
    return commitTypeConfig.release;
  }

  return null;
}


function getReleaseType(commit, config) {
  return getHigherType(
    getReleaseTypeFromCommitType(commit.type, config),
    commit.notes.reduce((type, note) => getHigherType(
      type,
      getReleaseTypeFromNote(note, config)
    ), null)
  );
}

function isError(type) {
  return type instanceof Error;
}

module.exports = function analyzeCommits(pluginConfig, config, callback) {
  getChangelogrcConfig().then((commitStyleConfig) => {
    const releaseType = config.commits
      .map((commit) => conventionalCommitsParser.sync(commit.message))
      .filter((commit) => !!commit)
      .reduce((type, commit) => {
        if (isMaxType(type) || isError(type)) {
          return type;
        }

        try {
          return getHigherType(
            type,
            getReleaseType(commit, commitStyleConfig)
          );
        } catch (err) {
          return err;
        }
      }, null);

    if (isError(releaseType)) {
      return callback(releaseType);
    }

    return callback(null, releaseType);
  });
};
