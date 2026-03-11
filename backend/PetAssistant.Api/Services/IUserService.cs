using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

public interface IUserService
{
    UserProfileResponse GetProfile();
}
