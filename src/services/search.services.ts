import { ObjectId } from 'mongodb'
import databaseService from './database.services'
import Tweet from '~/models/schemas/Tweets.schema'
import { MediaTypeQuery, MediaTypes, PeopleFollow, TweetType } from '~/constants/enums'

class searchServices {
  async search({
    content,
    limit,
    page,
    user_id,
    media_type,
    people_follow
  }: {
    content: string
    limit: number
    page: number
    user_id: string
    media_type?: MediaTypeQuery
    people_follow?: PeopleFollow
  }) {
    const $match: any = {
      $text: {
        $search: content
      }
    }
    if (media_type) {
      if (media_type === MediaTypeQuery.Image) {
        $match['medias.type'] = MediaTypes.Image
      }
      if (media_type === MediaTypeQuery.Video) {
        $match['medias.type'] = {
          $in: [MediaTypes.Video, MediaTypes.HLS]
        }
      }
    }
    if (people_follow && people_follow === '1') {
      const followed_user_id = await databaseService.followers
        .find(
          {
            user_id: new ObjectId(user_id)
          },
          {
            projection: {
              followed_user_id: 1,
              _id: 0
            }
          }
        )
        .toArray()
      const ids = followed_user_id.map((item) => item.followed_user_id) as ObjectId[]
      ids.push(new ObjectId(user_id))
      $match['user_id'] = {
        $in: ids
      }
    }

    const [tweets, total] = await Promise.all([
      databaseService.tweets
        .aggregate<Tweet>([
          {
            $match
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: {
              path: '$user'
            }
          },
          {
            $match: {
              $or: [
                {
                  audience: 0
                },
                {
                  $and: [
                    {
                      audience: 1
                    },
                    {
                      'user.twitter_circle': {
                        $in: [new ObjectId(user_id)]
                      }
                    }
                  ]
                }
              ]
            }
          },
          {
            $lookup: {
              from: 'hashtags',
              localField: 'hashtags',
              foreignField: '_id',
              as: 'hashtags'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'mentions',
              foreignField: '_id',
              as: 'mentions'
            }
          },
          {
            $addFields: {
              mentions: {
                $map: {
                  input: '$mentions',
                  as: 'item',
                  in: {
                    _id: '$$item._id',
                    username: '$$item.username',
                    email: '$$item.email'
                  }
                }
              }
            }
          },
          {
            $lookup: {
              from: 'bookmarks',
              localField: '_id',
              foreignField: 'tweet_id',
              as: 'bookmarks'
            }
          },
          {
            $lookup: {
              from: 'likes',
              localField: '_id',
              foreignField: 'tweet_id',
              as: 'likes'
            }
          },
          {
            $addFields: {
              bookmarks: {
                $size: '$bookmarks'
              },
              likes: {
                $size: '$likes'
              }
            }
          },
          {
            $lookup: {
              from: 'tweets',
              localField: '_id',
              foreignField: 'parent_id',
              as: 'tweet_children'
            }
          },
          {
            $addFields: {
              retweet_count: {
                $size: {
                  $filter: {
                    input: '$tweet_children',
                    as: 'item',
                    cond: {
                      $eq: ['$$item.type', TweetType.Retweet]
                    }
                  }
                }
              },
              comment_count: {
                $size: {
                  $filter: {
                    input: '$tweet_children',
                    as: 'item',
                    cond: {
                      $eq: ['$$item.type', TweetType.Comment]
                    }
                  }
                }
              },
              quote_count: {
                $size: {
                  $filter: {
                    input: '$tweet_children',
                    as: 'item',
                    cond: {
                      $eq: ['$$item.type', TweetType.QuoteTweet]
                    }
                  }
                }
              }
            }
          },
          {
            $project: {
              tweet_children: 0,
              user: {
                password: 0,
                date_of_birth: 0,
                email_verify_token: 0,
                forgot_password_token: 0
              }
            }
          },
          {
            $skip: limit * (page - 1)
          },
          {
            $limit: limit
          }
        ])
        .toArray(),
      databaseService.tweets
        .aggregate([
          {
            $match
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: {
              path: '$user'
            }
          },
          {
            $match: {
              $or: [
                {
                  audience: 0
                },
                {
                  $and: [
                    {
                      audience: 1
                    },
                    {
                      'user.twitter_circle': {
                        $in: [new ObjectId(user_id)]
                      }
                    }
                  ]
                }
              ]
            }
          },
          {
            $count: 'total'
          }
        ])
        .toArray()
    ])
    const tweet_ids = tweets.map((tweet) => tweet._id) as ObjectId[]
    const date = new Date()
    await databaseService.tweets.updateMany(
      { _id: { $in: tweet_ids } },
      {
        $inc: { user_views: 1 },
        $set: {
          updated_at: date
        }
      }
    )
    tweets.forEach((tweet) => {
      tweet.updated_at = date
      tweet.user_views += 1
    })
    return {
      tweets,
      total: total.length > 0 ? total[0].total : 0
    }
  }
}
const searchService = new searchServices()
export default searchService
